import { jest } from "@jest/globals";
import pg from "pg";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { userInfo } from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { fileTypeFromFile } from "file-type";
import { chatVideoFormats, createChatVideoFixture } from "../../helpers/chat-video-fixture.js";

let directory, pool;
const db = {
  query: (...args) => pool.query(...args),
  transaction: async fn => {
    const client = await pool.connect();
    try { await client.query("BEGIN"); const value = await fn(client); await client.query("COMMIT"); return value; }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  },
};
const pathFor = key => join(directory, "uploads", key);
jest.unstable_mockModule("../../../src/database/database-manager.js", () => ({ default: db }));
jest.unstable_mockModule("../../../src/providers/storage/local.provider.js", () => ({ resolveStoragePath: pathFor }));
jest.unstable_mockModule("../../../src/providers/storage/video-object-storage.provider.js", () => ({ default: { enabled:false } }));
const { default: media } = await import("../../../src/modules/media/media.repository.js");
const { createChatMediaProcessor, markChatMediaFailed } = await import("../../../src/modules/chat/chat-media.processor.js");
const { getChatPreview, decorateChatMedia } = await import("../../../src/modules/chat/chat-media.service.js");
const owner = randomUUID();
const upload = (overrides = {}) => ({ storageProvider:"local",bucket:"local",storageKey:`chat/${randomUUID()}.mp4`,
  originalFilename:"original.mp4",mimeType:"video/mp4",extension:"mp4",fileSize:100,checksum:randomUUID(),fileIndex:0,...overrides });
const resolve = (file, dedupScope="chat_private",isPublic=false,userId=owner) =>
  db.transaction(client => media.resolveUploadedAssets({client,userId,isPublic,dedupScope,uploads:[file]}));

(process.env.RUN_CHAT_MEDIA_DB_TESTS === "1" ? describe : describe.skip)("private chat media on isolated PostgreSQL", () => {
  beforeAll(async () => {
    directory=mkdtempSync("/tmp/artictern-chat-media-");
    execFileSync("initdb",["-D",`${directory}/data`,"--auth=trust","--no-locale","--encoding=UTF8"],{stdio:"pipe"});
    execFileSync("pg_ctl",["-D",`${directory}/data`,"-l",`${directory}/postgres.log`,"-o",`-k ${directory} -h ''`,"-w","start"],{stdio:"pipe"});
    pool=new pg.Pool({host:directory,user:userInfo().username,database:"postgres"});
    await pool.query(`CREATE SCHEMA media; CREATE SCHEMA chat;
      CREATE TABLE media.assets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),storage_provider text,bucket text,storage_key text,
        original_filename text,mime_type text,extension text,file_size bigint,checksum text,uploaded_by uuid,is_public boolean,
        original_width int,original_height int,duration_seconds int,processing_status text,processing_error text,processed_at timestamp,
        deleted_at timestamp,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now(),
        CONSTRAINT uq_assets_owner_checksum UNIQUE(uploaded_by,checksum));
      CREATE TABLE chat.chat_messages(id uuid PRIMARY KEY,conversation_id uuid,deleted_at timestamp);
      CREATE TABLE chat.message_assets(message_id uuid,asset_id uuid);
      CREATE TABLE chat.event_outbox(conversation_id uuid,message_id uuid,event_type text);`);
    await pool.query(readFileSync(new URL("../../../src/database/migrations/090_isolate_private_chat_assets.sql",import.meta.url),"utf8"));
    mkdirSync(pathFor("chat"),{recursive:true});
  },30000);
  afterAll(async () => {
    await pool?.end();
    if(directory){try{execFileSync("pg_ctl",["-D",`${directory}/data`,"-m","fast","-w","stop"],{stdio:"pipe"});}
      finally{rmSync(directory,{recursive:true,force:true});}}
  });

  test("same public R2 file gets a separate private local chat asset; public row stays unchanged",async()=>{
    const file=upload();
    const publicAsset=(await resolve({...file,storageProvider:"r2",bucket:"public",storageKey:"posts/video.mp4"},"general",true)).assets[0];
    const before=(await pool.query("SELECT * FROM media.assets WHERE id=$1",[publicAsset.id])).rows[0];
    const chat=(await resolve(file)).assets[0];
    expect(chat.id).not.toBe(publicAsset.id);expect(chat.storage_provider).toBe("local");expect(chat.is_public).toBe(false);
    expect((await pool.query("SELECT * FROM media.assets WHERE id=$1",[publicAsset.id])).rows[0]).toEqual(before);
    expect((await resolve(file,"general",true)).assets[0].id).toBe(publicAsset.id);
  });
  test("repeated private uploads deduplicate; simultaneous uploads cannot create duplicate rows",async()=>{
    const file=upload();const results=await Promise.all([resolve(file),resolve({...file,storageKey:"chat/another.mp4"})]);
    expect(results[0].assets[0].id).toBe(results[1].assets[0].id);
    expect(results.flatMap(r=>r.unusedStoredObjects)).toHaveLength(1);
  });
  test("same checksum remains isolated between users and general/private scopes",async()=>{
    const file=upload();const a=(await resolve(file)).assets[0];
    const b=(await resolve(file,"chat_private",false,randomUUID())).assets[0];
    const c=(await resolve(file,"general",false)).assets[0];
    expect(new Set([a.id,b.id,c.id]).size).toBe(3);
  });
  test("database prevents private chat assets becoming public or remote; posts cannot attach them",async()=>{
    const asset=(await resolve(upload())).assets[0];
    await expect(pool.query("UPDATE media.assets SET is_public=true WHERE id=$1",[asset.id])).rejects.toMatchObject({code:"23514"});
    await expect(pool.query("UPDATE media.assets SET storage_provider='r2' WHERE id=$1",[asset.id])).rejects.toMatchObject({code:"23514"});
    expect(await media.findOwnedPostAssets({client:pool,userId:owner,assetIds:[asset.id]})).toEqual([]);
  });
  test("deleted private asset restores in its own scope without modifying a general asset",async()=>{
    const file=upload();const asset=(await resolve(file)).assets[0];
    await pool.query("UPDATE media.assets SET deleted_at=now() WHERE id=$1",[asset.id]);
    const restored=(await resolve({...file,storageKey:"chat/restored.mp4"})).assets[0];
    expect(restored.id).toBe(asset.id);expect(restored.storage_key).toBe("chat/restored.mp4");expect(restored.is_public).toBe(false);
  });

  async function fixture(mime="image/png",extension="mp4") {
    const key=`chat/${randomUUID()}.${mime.startsWith("image")?"png":extension}`,file=upload({storageKey:key,mimeType:mime,extension});
    if(mime.startsWith("image"))await sharp({create:{width:640,height:480,channels:3,background:"orange"}}).png().toFile(pathFor(key));
    else createChatVideoFixture(pathFor(key),extension);
    const asset=(await resolve(file)).assets[0];
    await pool.query("UPDATE media.assets SET processing_status='READY' WHERE id=$1",[asset.id]);
    await pool.query("INSERT INTO chat.asset_optimizations(asset_id) VALUES($1)",[asset.id]);
    const message=randomUUID(),conversation=randomUUID();
    await pool.query("INSERT INTO chat.chat_messages VALUES($1,$2,NULL)",[message,conversation]);
    await pool.query("INSERT INTO chat.message_assets VALUES($1,$2)",[message,asset.id]);
    return {asset,key,message,conversation};
  }
  const digest = key => createHash("sha256").update(readFileSync(pathFor(key))).digest("hex");
  test("real image optimization preserves original and emits one refresh event; response exposes no storage keys",async()=>{
    const f=await fixture(),before=digest(f.key);await createChatMediaProcessor()(f.asset.id);
    expect(digest(f.key)).toBe(before);
    const [message]=await decorateChatMedia(pool,f.conversation,[{id:f.message,assets:[{id:f.asset.id,url:"original"}]}]);
    expect(message.assets[0].url).toBe("original");
    expect(message.assets[0].optimization).toMatchObject({status:"READY",width:640,height:480});
    expect(message.assets[0].optimization.imageVariants).toHaveLength(4);
    expect(JSON.stringify(message)).not.toContain("storageKey");
    const resource=await getChatPreview(f.asset.id,{kind:"image",size:320});expect(resource.mimeType).toBe("image/webp");
    await createChatMediaProcessor()(f.asset.id);
    expect((await pool.query("SELECT * FROM chat.event_outbox WHERE message_id=$1",[f.message])).rows).toHaveLength(1);
  });
  test.each(chatVideoFormats)("real %s (%s) optimization preserves original and provides private HLS, thumbnail and MP4",async(extension,mime)=>{
    const f=await fixture(mime,extension),before=digest(f.key);
    expect((await fileTypeFromFile(pathFor(f.key))).mime).toBe(mime);
    await createChatMediaProcessor()(f.asset.id);
    expect(digest(f.key)).toBe(before);
    const master=await getChatPreview(f.asset.id,{kind:"master"});const text=readFileSync(master.filePath,"utf8");
    expect(text).toContain("#EXTM3U");expect(text).toContain("360p/index.m3u8");
    const index=await getChatPreview(f.asset.id,{kind:"segment",rendition:"360p",fileName:"index.m3u8"});
    const segment=readFileSync(index.filePath,"utf8").split("\n").find(line=>line.endsWith(".ts"));
    expect((await getChatPreview(f.asset.id,{kind:"segment",rendition:"360p",fileName:segment})).mimeType).toBe("video/mp2t");
    expect((await getChatPreview(f.asset.id,{kind:"thumbnail"})).mimeType).toBe("image/jpeg");
    expect((await getChatPreview(f.asset.id,{kind:"video"})).mimeType).toBe("video/mp4");
    await expect(getChatPreview(f.asset.id,{kind:"segment",rendition:"360p",fileName:"../../original.mp4"})).rejects.toMatchObject({statusCode:404});
  },60000);
  test("outbox failure rolls back preview publication; original stays intact and retry succeeds",async()=>{
    const f=await fixture(),before=digest(f.key);
    const failing={transaction:fn=>db.transaction(client=>fn({query:async(sql,args)=>{
      if(sql.includes("INSERT INTO chat.event_outbox"))throw Error("outbox failed");return client.query(sql,args);
    }}))};
    await expect(createChatMediaProcessor({db:failing})(f.asset.id)).rejects.toThrow("outbox failed");
    expect(digest(f.key)).toBe(before);
    expect((await pool.query("SELECT status FROM chat.asset_optimizations WHERE asset_id=$1",[f.asset.id])).rows[0].status).toBe("PENDING");
    await createChatMediaProcessor()(f.asset.id);
  });
  test("pending and failed optimization keep original URL; deleted assets cannot deliver previews",async()=>{
    const f=await fixture();
    const [message]=await decorateChatMedia(pool,f.conversation,[{id:f.message,assets:[{id:f.asset.id,url:"original"}]}]);
    expect(message.assets[0].optimization).toMatchObject({status:"PENDING",imageVariants:[],streamUrl:null});
    expect(message.assets[0].url).toBe("original");
    await expect(getChatPreview(f.asset.id,{kind:"image",size:320})).rejects.toMatchObject({statusCode:404});
    await createChatMediaProcessor()(f.asset.id);
    await pool.query("UPDATE media.assets SET deleted_at=now() WHERE id=$1",[f.asset.id]);
    await expect(getChatPreview(f.asset.id,{kind:"image",size:320})).rejects.toMatchObject({statusCode:404});
  });
  test("final optimization failure notifies once and retains the original download fallback",async()=>{
    const f=await fixture(),before=digest(f.key);
    await markChatMediaFailed(f.asset.id);await markChatMediaFailed(f.asset.id);
    const [message]=await decorateChatMedia(pool,f.conversation,[{id:f.message,assets:[{id:f.asset.id,url:"original"}]}]);
    expect(message.assets[0].optimization.status).toBe("FAILED");expect(message.assets[0].url).toBe("original");
    expect(digest(f.key)).toBe(before);
    expect((await pool.query("SELECT * FROM chat.event_outbox WHERE message_id=$1",[f.message])).rows).toHaveLength(1);
  });
});
