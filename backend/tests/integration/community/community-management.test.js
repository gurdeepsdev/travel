import { jest } from "@jest/globals";
import pg from "pg";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { userInfo } from "node:os";
import { randomUUID } from "node:crypto";

let directory,pool,owner,member,other,iconId,failEvents=false;
const db={query:(...args)=>pool.query(...args),transaction:async fn=>{
  const c=await pool.connect();
  try{await c.query("BEGIN");const result=await fn({query:(sql,args)=>{
    if(failEvents&&sql.includes("INSERT INTO chat.event_outbox"))throw Error("outbox unavailable");return c.query(sql,args);
  }});await c.query("COMMIT");return result;}catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
}};
jest.unstable_mockModule("../../../src/database/database-manager.js",()=>({default:db}));
jest.unstable_mockModule("../../../src/modules/chat/chat-malware.service.js",()=>({scanChatAttachment:jest.fn()}));
const {default:communities}=await import("../../../src/modules/community/community.repository.js");
const {default:chat}=await import("../../../src/modules/chat/chat.repository.js");
const {default:messages}=await import("../../../src/modules/chat/chat-messages.service.js");
const {default:inbox}=await import("../../../src/modules/chat/chat-inbox.service.js");
const migration=name=>readFileSync(new URL(`../../../src/database/migrations/${name}`,import.meta.url),"utf8");
const create=async(joinType="OPEN")=>(await communities.create(owner,{name:"Community",iconAssetId:iconId,joinType})).community;
const state=id=>pool.query("SELECT * FROM community.communities WHERE id=$1",[id]).then(r=>r.rows[0]);

(process.env.RUN_COMMUNITY_DB_TESTS==="1"?describe:describe.skip)("community management on isolated PostgreSQL",()=>{
  beforeAll(async()=>{
    directory=mkdtempSync("/tmp/artictern-community-");
    execFileSync("initdb",["-D",`${directory}/data`,"--auth=trust","--no-locale","--encoding=UTF8"],{stdio:"pipe"});
    execFileSync("pg_ctl",["-D",`${directory}/data`,"-l",`${directory}/pg.log`,"-o",`-k ${directory} -h ''`,"-w","start"],{stdio:"pipe"});
    pool=new pg.Pool({host:directory,user:userInfo().username,database:"postgres"});
    await pool.query(`CREATE SCHEMA auth;CREATE SCHEMA media;CREATE SCHEMA users;CREATE SCHEMA community;CREATE SCHEMA groups;CREATE SCHEMA chat;
      CREATE TABLE auth.users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),status text);
      CREATE TABLE auth.sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
      CREATE TABLE media.assets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),uploaded_by uuid,is_public boolean,deleted_at timestamp,processing_status text,mime_type text,file_size bigint);
      CREATE TABLE users.profiles(user_id uuid REFERENCES auth.users(id),username text,display_name text,profile_photo_asset_id uuid,deleted_at timestamp);
      CREATE TABLE users.blocked_users(user_id uuid,blocked_user_id uuid);
      CREATE TABLE groups.groups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid,status text,deleted_at timestamp,name text,cover_asset_id uuid);
      CREATE TABLE groups.group_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid,user_id uuid,status text);
      CREATE TABLE chat.conversations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_type text,group_id uuid,community_id uuid UNIQUE,direct_key text,request_status text,requested_by uuid,last_message_id uuid,deleted_at timestamp,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now());
      CREATE TABLE chat.conversation_participants(conversation_id uuid REFERENCES chat.conversations(id) ON DELETE CASCADE,user_id uuid,left_at timestamp);
      CREATE TABLE chat.chat_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid REFERENCES chat.conversations(id) ON DELETE CASCADE,sent_by uuid,message_type text,message_content text,reply_to_message_id uuid,itinerary_id uuid,created_at timestamp DEFAULT clock_timestamp(),edited_at timestamp,group_event jsonb,change_request_id uuid,change_request_status text,change_request_changes jsonb);
      CREATE TABLE chat.message_assets(message_id uuid,asset_id uuid,display_order int);
      CREATE TABLE chat.message_reactions(message_id uuid,user_id uuid,reaction text,created_at timestamp DEFAULT now(),PRIMARY KEY(message_id,user_id));`);
    // Use the repository's actual baseline table definitions and constraints, verified against UAT.
    const source=readFileSync(new URL("../../../../database/migrations/001_initial_schema.sql",import.meta.url),"utf8");
    const tables=source.match(/CREATE TABLE community\.[\s\S]*?\n\);/g);
    expect(tables).toHaveLength(4);for(const sql of tables)await pool.query(sql);
    for(const sql of source.match(/ALTER TABLE ONLY community\.[\s\S]*?;\n/g)??[])await pool.query(sql);
    for(const name of ["076_chat_message_lifecycle.sql","077_chat_inbox_notifications.sql","078_chat_event_replay.sql","079_chat_conversation_event_sequence.sql","086_community_management.sql","091_community_invitations.sql"])await pool.query(migration(name));
  },30000);
  afterAll(async()=>{await pool?.end();if(directory){try{execFileSync("pg_ctl",["-D",`${directory}/data`,"-m","fast","-w","stop"],{stdio:"pipe"});}finally{rmSync(directory,{recursive:true,force:true});}}});
  beforeEach(async()=>{
    failEvents=false;
    await pool.query("TRUNCATE community.communities,chat.conversations,auth.users,media.assets CASCADE");
    [owner,member,other]=[randomUUID(),randomUUID(),randomUUID()];
    for(const id of [owner,member,other]){
      await pool.query("INSERT INTO auth.users VALUES($1,'ACTIVE')",[id]);
      await pool.query("INSERT INTO users.profiles(user_id,username,display_name) VALUES($1,$2,$2)",[id,id]);
    }
    iconId=(await pool.query("INSERT INTO media.assets(uploaded_by,is_public,processing_status,mime_type) VALUES($1,true,'READY','image/png') RETURNING id",[owner])).rows[0].id;
  });
  test.each(["OPEN","APPROVAL"])("create %s community is atomic with admin membership and conversation",async mode=>{
    const c=await create(mode);expect(c).toMatchObject({viewerRole:"ADMIN",memberCount:1,joinType:mode});expect(c.conversationId).toBeTruthy();
    expect(await chat.access(pool,c.conversationId,owner)).toMatchObject({can_send:true});
    expect((await communities.list(owner,{limit:10},true)).communities).toHaveLength(1);
    expect((await communities.list(member,{limit:10},true)).communities).toHaveLength(0);
  });
  test("share URLs are consistent in creation, details and both lists without bypassing membership",async()=>{
    const c=await create("APPROVAL");
    const expected=`${(process.env.PUBLIC_WEB_URL??"https://artictern.com").trim().replace(/\/+$/,"")}/c/${c.id}`;
    expect(c.shareUrl).toBe(expected);
    expect((await communities.get(member,c.id)).community).toMatchObject({shareUrl:expected,conversationId:null,viewerRole:null});
    expect((await communities.list(member,{limit:10})).communities[0].shareUrl).toBe(expected);
    expect((await communities.list(owner,{limit:10},true)).communities[0].shareUrl).toBe(expected);
    const updated=await communities.update(owner,c.id,{name:"Renamed"});
    expect(updated.community.shareUrl).toBe(expected);
    const joined=await communities.join(member,c.id);expect(joined.status).toBe("PENDING");
    expect(await chat.access(pool,c.conversationId,member)).toBeNull();
    await communities.memberAction(owner,c.id,member,"ban");
    await expect(communities.get(member,c.id)).rejects.toMatchObject({statusCode:404});
    expect((await communities.list(member,{limit:10})).communities).toHaveLength(0);
    await communities.remove(owner,c.id);
    await expect(communities.get(owner,c.id)).rejects.toMatchObject({statusCode:404});
  });
  test("multipart image and community creation share one rollback boundary",async()=>{
    const assetId=randomUUID();
    await expect(db.transaction(async client=>{
      await client.query("INSERT INTO media.assets(id,uploaded_by,is_public,processing_status,mime_type) VALUES($1,$2,true,'READY','image/png')",[assetId,owner]);
      await communities.createInTransaction(owner,{name:"Rollback",iconAssetId:assetId,joinType:"OPEN"},client);
      throw Error("rollback after creation");
    })).rejects.toThrow("rollback after creation");
    for(const table of ["community.communities","community.community_members","chat.conversations"]){
      expect((await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`)).rows[0].count).toBe(0);
    }
    expect((await pool.query("SELECT id FROM media.assets WHERE id=$1",[assetId])).rows).toHaveLength(0);
    const id=await db.transaction(async client=>{
      await client.query("INSERT INTO media.assets(id,uploaded_by,is_public,processing_status,mime_type) VALUES($1,$2,true,'READY','image/png')",[assetId,owner]);
      return communities.createInTransaction(owner,{name:"Committed",iconAssetId:assetId,joinType:"OPEN"},client);
    });
    expect((await communities.get(owner,id)).community).toMatchObject({name:"Committed",viewerRole:"ADMIN",image:{id:assetId}});
  });
  test("multipart image replacement and metadata updates share the event transaction",async()=>{
    const c=await create("APPROVAL"),assetId=randomUUID();
    failEvents=true;
    await expect(db.transaction(async client=>{
      await communities.lockForUpdate(owner,c.id,client);
      await client.query("INSERT INTO media.assets(id,uploaded_by,is_public,processing_status,mime_type) VALUES($1,$2,true,'READY','image/png')",[assetId,owner]);
      await communities.updateInTransaction(owner,c.id,{name:"New",iconAssetId:assetId},client);
    })).rejects.toThrow("outbox unavailable");
    failEvents=false;
    expect(await state(c.id)).toMatchObject({name:"Community",icon_asset_id:iconId,join_type:"APPROVAL"});
    expect((await pool.query("SELECT id FROM media.assets WHERE id=$1",[assetId])).rows).toHaveLength(0);
    await db.transaction(async client=>{
      await communities.lockForUpdate(owner,c.id,client);
      await client.query("INSERT INTO media.assets(id,uploaded_by,is_public,processing_status,mime_type) VALUES($1,$2,true,'READY','image/png')",[assetId,owner]);
      await communities.updateInTransaction(owner,c.id,{iconAssetId:assetId},client);
    });
    expect(await state(c.id)).toMatchObject({name:"Community",icon_asset_id:assetId,join_type:"APPROVAL"});
    expect((await pool.query("SELECT id FROM media.assets WHERE id=$1",[iconId])).rows).toHaveLength(1);
    await expect(db.transaction(client=>communities.lockForUpdate(member,c.id,client))).rejects.toMatchObject({statusCode:404});
  });
  test("foreign, private, deleted or non-image icons are rejected without creating rows",async()=>{
    await expect(communities.create(member,{name:"bad",iconAssetId:iconId,joinType:"OPEN"})).rejects.toMatchObject({statusCode:422});
    for(const sql of ["is_public=false","deleted_at=now()","mime_type='video/mp4'"]){
      await pool.query("UPDATE media.assets SET is_public=true,deleted_at=NULL,mime_type='image/png' WHERE id=$1",[iconId]);
      await pool.query(`UPDATE media.assets SET ${sql} WHERE id=$1`,[iconId]);
      await expect(create()).rejects.toMatchObject({statusCode:422});
    }
    expect((await pool.query("SELECT * FROM community.communities")).rows).toHaveLength(0);
  });
  test("open join is idempotent, lists profiles and allows reactions but not member messages",async()=>{
    const c=await create();await communities.join(member,c.id);await communities.join(member,c.id);
    expect((await state(c.id)).member_count).toBe(2);
    expect((await communities.members(member,c.id,{limit:10})).members).toHaveLength(2);
    const sent=await messages.send(owner,c.conversationId,{clientMessageId:randomUUID(),text:"Admin notice"});
    await expect(messages.send(member,c.conversationId,{clientMessageId:randomUUID(),text:"No"})).rejects.toMatchObject({statusCode:403});
    await messages.react(member,c.conversationId,sent.message.id,"👍");
    expect((await pool.query("SELECT * FROM chat.message_reactions")).rows).toHaveLength(1);
    expect((await inbox.list(member,{limit:10,archived:false})).conversations[0]).toMatchObject({canSend:false,unreadCount:1});
  });
  test("approval requires admin review; pending members cannot access chat",async()=>{
    const c=await create("APPROVAL"),r=await communities.join(member,c.id);
    expect(await communities.join(member,c.id)).toMatchObject({requestId:r.requestId,updated:false});
    expect(await chat.access(pool,c.conversationId,member)).toBeNull();
    expect((await communities.requests(owner,c.id,{limit:10,status:"PENDING"})).requests).toHaveLength(1);
    await expect(communities.review(other,c.id,r.requestId,"ACCEPTED")).rejects.toMatchObject({statusCode:404});
    await communities.review(owner,c.id,r.requestId,"ACCEPTED");
    expect(await communities.review(owner,c.id,r.requestId,"ACCEPTED")).toMatchObject({updated:false});
    expect(await chat.access(pool,c.conversationId,member)).toMatchObject({can_send:false});
  });
  test("requester can cancel only their request, reject/cancel can be followed by a new request",async()=>{
    const c=await create("APPROVAL"),r=await communities.join(member,c.id);
    await expect(communities.review(other,c.id,r.requestId,"CANCELLED",true)).rejects.toMatchObject({statusCode:404});
    await communities.review(member,c.id,r.requestId,"CANCELLED",true);
    const next=await communities.join(member,c.id);expect(next.requestId).not.toBe(r.requestId);
    await communities.review(owner,c.id,next.requestId,"REJECTED");
    await expect(communities.review(owner,c.id,next.requestId,"ACCEPTED")).rejects.toMatchObject({statusCode:409});
    expect((await communities.join(member,c.id)).status).toBe("PENDING");
  });
  test("admins have equal powers and demoted creators do not retain privileged access",async()=>{
    const c=await create();await communities.join(member,c.id);
    await communities.memberAction(owner,c.id,member,"role",{role:"ADMIN"});
    await communities.memberAction(member,c.id,owner,"role",{role:"MEMBER"});
    await expect(communities.update(owner,c.id,{name:"forbidden"})).rejects.toMatchObject({statusCode:404});
    await communities.update(member,c.id,{name:"Updated",description:"Description"});
    expect((await communities.get(owner,c.id)).community.name).toBe("Updated");
    expect(await chat.access(pool,c.conversationId,owner)).toMatchObject({can_send:false});
    await communities.remove(member,c.id);expect(await chat.access(pool,c.conversationId,owner)).toBeNull();
  });
  test("last admin cannot demote; leaving elects an active member and revokes leaver chat access",async()=>{
    const c=await create();await communities.join(member,c.id);
    await expect(communities.memberAction(owner,c.id,owner,"role",{role:"MEMBER"})).rejects.toMatchObject({statusCode:409});
    await communities.memberAction(owner,c.id,owner,"leave");
    expect((await communities.get(member,c.id)).community.viewerRole).toBe("ADMIN");
    expect(await chat.access(pool,c.conversationId,owner)).toBeNull();
    await expect(chat.create(owner,{type:"community",communityId:c.id})).resolves.toBeNull();
    await communities.join(owner,c.id);expect((await communities.get(owner,c.id)).community.viewerRole).toBe("MEMBER");
  });
  test("removed admins rejoin as members; bans block discovery, joining, inbox and chat",async()=>{
    const c=await create();await communities.join(member,c.id);await communities.memberAction(owner,c.id,member,"role",{role:"ADMIN"});
    await communities.memberAction(owner,c.id,member,"remove");await communities.join(member,c.id);
    expect((await communities.get(member,c.id)).community.viewerRole).toBe("MEMBER");
    await communities.memberAction(owner,c.id,member,"ban",{reason:"spam"});
    expect((await communities.members(owner,c.id,{limit:10},true)).bans).toHaveLength(1);
    await expect(communities.join(member,c.id)).rejects.toMatchObject({statusCode:404});
    expect((await communities.list(member,{limit:10})).communities).toHaveLength(0);
    expect(await chat.access(pool,c.conversationId,member)).toBeNull();
    expect((await inbox.list(member,{limit:10,archived:false})).conversations).toHaveLength(0);
    await communities.memberAction(owner,c.id,member,"unban");expect(await chat.access(pool,c.conversationId,member)).toBeNull();
    await communities.join(member,c.id);expect(await chat.access(pool,c.conversationId,member)).toMatchObject({can_send:false});
  });
  test("member-only and admin-only list/edit/delete actions reject outsiders",async()=>{
    const c=await create();
    for(const call of [()=>communities.members(other,c.id,{limit:10}),()=>communities.members(other,c.id,{limit:10},true),
      ()=>communities.requests(other,c.id,{limit:10,status:"PENDING"}),()=>communities.update(other,c.id,{name:"bad"}),()=>communities.remove(other,c.id)]){
      await expect(call()).rejects.toMatchObject({statusCode:404});
    }
    await expect(communities.memberAction(owner,c.id,owner,"ban")).rejects.toMatchObject({statusCode:409});
  });
  test("metadata updates journal realtime events transactionally; failure rolls back the update",async()=>{
    const c=await create();failEvents=true;
    await expect(communities.update(owner,c.id,{name:"not committed"})).rejects.toThrow("outbox unavailable");
    failEvents=false;expect((await state(c.id)).name).toBe("Community");
    await communities.update(owner,c.id,{description:"new"});
    expect((await pool.query("SELECT * FROM chat.event_outbox WHERE conversation_id=$1",[c.conversationId])).rows[0].event_type).toBe("conversation.updated");
  });
  test("empty community archives; deleted community disappears and rejects joins",async()=>{
    const c=await create();await communities.memberAction(owner,c.id,owner,"leave");
    expect((await state(c.id)).deleted_at).not.toBeNull();
    await expect(communities.join(member,c.id)).rejects.toMatchObject({statusCode:404});
  });
  test("migration is repeatable and never restores a removed creator",async()=>{
    const c=await create();await communities.join(member,c.id);await communities.memberAction(owner,c.id,member,"role",{role:"ADMIN"});
    await communities.memberAction(member,c.id,owner,"remove");
    await pool.query(migration("086_community_management.sql"));await pool.query(migration("086_community_management.sql"));
    expect(await chat.access(pool,c.conversationId,owner)).toBeNull();expect((await state(c.id)).member_count).toBe(1);
  });
  test("concurrent joining is serialized and stable cursor pagination does not repeat communities",async()=>{
    const c=await create();await Promise.all([communities.join(member,c.id),communities.join(member,c.id)]);
    expect((await state(c.id)).member_count).toBe(2);await create();await create();
    const first=await communities.list(other,{limit:2}),next=await communities.list(other,{limit:2,cursor:first.pagination.nextCursor});
    expect(first.pagination.hasMore).toBe(true);expect(next.communities).toHaveLength(1);
    expect(new Set([...first.communities,...next.communities].map(x=>x.id)).size).toBe(3);
  });
  test("suggestions exclude creators and joined members while my communities retains them",async()=>{
    const c=await create();
    expect((await communities.list(owner,{limit:10})).communities).toHaveLength(0);
    expect((await communities.list(owner,{limit:10},true)).communities.map(x=>x.id)).toEqual([c.id]);
    expect((await communities.list(member,{limit:10})).communities.map(x=>x.id)).toEqual([c.id]);
    await communities.join(member,c.id);
    expect((await communities.list(member,{limit:10})).communities).toHaveLength(0);
    expect((await communities.list(member,{limit:10},true)).communities.map(x=>x.id)).toEqual([c.id]);
  });
  test("approval suggestions remain until acceptance, then move to my communities",async()=>{
    const c=await create("APPROVAL"),r=await communities.join(member,c.id);
    expect((await communities.list(member,{limit:10})).communities.map(x=>x.id)).toEqual([c.id]);
    expect((await communities.list(member,{limit:10},true)).communities).toHaveLength(0);
    await communities.review(owner,c.id,r.requestId,"ACCEPTED");
    expect((await communities.list(member,{limit:10})).communities).toHaveLength(0);
    expect((await communities.list(member,{limit:10},true)).communities.map(x=>x.id)).toEqual([c.id]);
  });
  test.each(["leave","remove"])("%s restores suggestions but not active membership",async action=>{
    const c=await create();await communities.join(member,c.id);
    await communities.memberAction(action==="leave"?member:owner,c.id,member,action);
    expect((await communities.list(member,{limit:10})).communities.map(x=>x.id)).toEqual([c.id]);
    expect((await communities.list(member,{limit:10},true)).communities).toHaveLength(0);
  });
  test("suggestion filtering precedes search and pagination without hiding eligible results",async()=>{
    const joined=await create();await communities.join(member,joined.id);
    const eligible=[await create(),await create(),await create()];
    for(const c of eligible)await communities.update(owner,c.id,{name:"Eligible community"});
    const first=await communities.list(member,{limit:2,search:"Eligible"});
    expect(first.communities).toHaveLength(2);expect(first.pagination.hasMore).toBe(true);
    const next=await communities.list(member,{limit:2,search:"Eligible",cursor:first.pagination.nextCursor});
    expect(next.communities).toHaveLength(1);expect(next.pagination.hasMore).toBe(false);
    expect(new Set([...first.communities,...next.communities].map(x=>x.id))).toEqual(new Set(eligible.map(x=>x.id)));
    expect((await communities.list(member,{limit:10},true)).communities.map(x=>x.id)).toEqual([joined.id]);
  });
  test.each(["OPEN","APPROVAL"])("admin invitation to %s waits for recipient acceptance and grants MEMBER only",async mode=>{
    const c=await create(mode),{invitation}=await communities.invite(owner,c.id,member);
    expect(invitation).toMatchObject({communityId:c.id,userId:member,invitedBy:owner,status:"PENDING"});
    expect((await state(c.id)).member_count).toBe(1);expect(await chat.access(pool,c.conversationId,member)).toBeNull();
    expect((await communities.get(member,c.id)).community.viewerRole).toBeNull();
    const list=await communities.listInvitations(member,{limit:10,status:"PENDING"});
    expect(list.invitations[0]).toMatchObject({id:invitation.id,community:{id:c.id},inviter:{id:owner}});
    expect((await communities.listInvitations(other,{limit:10,status:"PENDING"})).invitations).toHaveLength(0);
    expect((await communities.listInvitations(owner,{limit:10,status:"PENDING"},c.id)).invitations).toHaveLength(1);
    const accepted=await communities.respondInvitation(member,c.id,invitation.id,"ACCEPTED");
    expect(accepted).toMatchObject({updated:true,invitation:{status:"ACCEPTED"}});
    expect((await communities.get(member,c.id)).community).toMatchObject({viewerRole:"MEMBER",conversationId:c.conversationId});
    expect((await state(c.id)).member_count).toBe(2);expect(await chat.access(pool,c.conversationId,member)).toMatchObject({can_send:false});
    expect((await communities.list(member,{limit:10})).communities).toHaveLength(0);
    expect((await communities.respondInvitation(member,c.id,invitation.id,"ACCEPTED")).updated).toBe(false);
    expect((await state(c.id)).member_count).toBe(2);
    await expect(communities.respondInvitation(member,c.id,invitation.id,"DECLINED")).rejects.toMatchObject({statusCode:409});
  });
  test("only admins invite/cancel/list and only the recipient accepts or declines",async()=>{
    const c=await create();await communities.join(other,c.id);
    await expect(communities.invite(other,c.id,member)).rejects.toMatchObject({statusCode:404});
    await expect(communities.invite(member,c.id,other)).rejects.toMatchObject({statusCode:404});
    const {invitation}=await communities.invite(owner,c.id,member);
    for(const actor of [owner,other])await expect(communities.respondInvitation(actor,c.id,invitation.id,"ACCEPTED")).rejects.toMatchObject({statusCode:404});
    await expect(communities.respondInvitation(member,c.id,invitation.id,"CANCELLED",true)).rejects.toMatchObject({statusCode:404});
    await expect(communities.listInvitations(other,{limit:10,status:"PENDING"},c.id)).rejects.toMatchObject({statusCode:404});
    expect((await communities.respondInvitation(member,c.id,invitation.id,"DECLINED")).invitation.status).toBe("DECLINED");
    expect((await state(c.id)).member_count).toBe(2);
    await expect(communities.respondInvitation(member,c.id,invitation.id,"ACCEPTED")).rejects.toMatchObject({statusCode:409});
    const again=await communities.invite(owner,c.id,member);expect(again.invitation.id).not.toBe(invitation.id);
    expect((await communities.respondInvitation(owner,c.id,again.invitation.id,"CANCELLED",true)).invitation.status).toBe("CANCELLED");
    expect((await communities.respondInvitation(owner,c.id,again.invitation.id,"CANCELLED",true)).updated).toBe(false);
  });
  test("duplicate concurrent invitations from equal admins share one pending invitation",async()=>{
    const c=await create();await communities.join(other,c.id);await communities.memberAction(owner,c.id,other,"role",{role:"ADMIN"});
    const invitations=await Promise.all([communities.invite(owner,c.id,member),communities.invite(other,c.id,member)]);
    expect(invitations[0].invitation.id).toBe(invitations[1].invitation.id);
    expect(invitations.map(r=>r.updated).sort()).toEqual([false,true]);
    await communities.respondInvitation(other,c.id,invitations[0].invitation.id,"CANCELLED",true);
  });
  test("self, inactive, existing, banned and blocked recipients are rejected",async()=>{
    const c=await create();
    await expect(communities.invite(owner,c.id,owner)).rejects.toMatchObject({statusCode:422});
    await expect(communities.invite(owner,c.id,randomUUID())).rejects.toMatchObject({statusCode:404});
    await pool.query("UPDATE auth.users SET status='INACTIVE' WHERE id=$1",[member]);
    await expect(communities.invite(owner,c.id,member)).rejects.toMatchObject({statusCode:404});
    await pool.query("UPDATE auth.users SET status='ACTIVE' WHERE id=$1",[member]);
    await communities.join(member,c.id);
    await expect(communities.invite(owner,c.id,member)).rejects.toMatchObject({statusCode:409});
    await communities.memberAction(owner,c.id,member,"ban");
    await expect(communities.invite(owner,c.id,member)).rejects.toMatchObject({statusCode:409});
    for(const pair of [[owner,other],[other,owner]]){
      await pool.query("INSERT INTO users.blocked_users VALUES($1,$2)",pair);
      await expect(communities.invite(owner,c.id,other)).rejects.toMatchObject({statusCode:404});
      await pool.query("DELETE FROM users.blocked_users");
    }
  });
  test("ban and admin demotion revoke pending invitations",async()=>{
    const c=await create(),{invitation}=await communities.invite(owner,c.id,member);
    await communities.memberAction(owner,c.id,member,"ban");
    await expect(communities.respondInvitation(member,c.id,invitation.id,"ACCEPTED")).rejects.toMatchObject({statusCode:404});
    await communities.memberAction(owner,c.id,member,"unban");
    await expect(communities.respondInvitation(member,c.id,invitation.id,"ACCEPTED")).rejects.toMatchObject({statusCode:409});
    await communities.join(other,c.id);await communities.memberAction(owner,c.id,other,"role",{role:"ADMIN"});
    const fresh=await communities.invite(owner,c.id,member);
    await communities.memberAction(other,c.id,owner,"role",{role:"MEMBER"});
    await expect(communities.respondInvitation(member,c.id,fresh.invitation.id,"ACCEPTED")).rejects.toMatchObject({statusCode:409});
  });
  test("blocking after invitation hides it and prevents acceptance",async()=>{
    const c=await create(),{invitation}=await communities.invite(owner,c.id,member);
    await pool.query("INSERT INTO users.blocked_users VALUES($1,$2)",[member,owner]);
    expect((await communities.listInvitations(member,{limit:10,status:"PENDING"})).invitations).toHaveLength(0);
    await expect(communities.respondInvitation(member,c.id,invitation.id,"ACCEPTED")).rejects.toMatchObject({statusCode:409});
  });
  test.each(["leave","remove"])("inviter %s revokes their pending invitations",async action=>{
    const c=await create();await communities.join(other,c.id);await communities.memberAction(owner,c.id,other,"role",{role:"ADMIN"});
    const {invitation}=await communities.invite(owner,c.id,member);
    await communities.memberAction(action==="leave"?owner:other,c.id,owner,action);
    await expect(communities.respondInvitation(member,c.id,invitation.id,"ACCEPTED")).rejects.toMatchObject({statusCode:409});
    expect((await state(c.id)).member_count).toBe(1);
  });
  test("community deletion revokes invitations and cross-community IDs cannot be used",async()=>{
    const c=await create(),another=await create(),{invitation}=await communities.invite(owner,c.id,member);
    await expect(communities.respondInvitation(member,another.id,invitation.id,"ACCEPTED")).rejects.toMatchObject({statusCode:404});
    await communities.remove(owner,c.id);
    expect((await communities.listInvitations(member,{limit:10,status:"PENDING"})).invitations).toHaveLength(0);
    await expect(communities.respondInvitation(member,c.id,invitation.id,"ACCEPTED")).rejects.toMatchObject({statusCode:404});
  });
  test("concurrent acceptance increments once and accepted invitations cannot rejoin after leaving",async()=>{
    const c=await create(),{invitation}=await communities.invite(owner,c.id,member);
    const accepted=await Promise.all([communities.respondInvitation(member,c.id,invitation.id,"ACCEPTED"),communities.respondInvitation(member,c.id,invitation.id,"ACCEPTED")]);
    expect(accepted.map(r=>r.updated).sort()).toEqual([false,true]);expect((await state(c.id)).member_count).toBe(2);
    await communities.memberAction(member,c.id,member,"leave");
    expect((await communities.respondInvitation(member,c.id,invitation.id,"ACCEPTED")).updated).toBe(false);
    expect((await state(c.id)).member_count).toBe(1);expect(await chat.access(pool,c.conversationId,member)).toBeNull();
  });
  test("accept cancels a pending join request; normal joining cancels stale invitations",async()=>{
    const c=await create("APPROVAL"),request=await communities.join(member,c.id),{invitation}=await communities.invite(owner,c.id,member);
    await communities.respondInvitation(member,c.id,invitation.id,"ACCEPTED");
    expect((await pool.query("SELECT status FROM community.community_member_request WHERE id=$1",[request.requestId])).rows[0].status).toBe("CANCELLED");
    await communities.update(owner,c.id,{joinType:"OPEN"});
    const second=await communities.invite(owner,c.id,other);await communities.join(other,c.id);
    await expect(communities.respondInvitation(other,c.id,second.invitation.id,"ACCEPTED")).rejects.toMatchObject({statusCode:409});
    expect((await state(c.id)).member_count).toBe(3);
  });
  test("invitation acceptance rolls back membership and decision if realtime journaling fails",async()=>{
    const c=await create(),{invitation}=await communities.invite(owner,c.id,member);failEvents=true;
    await expect(communities.respondInvitation(member,c.id,invitation.id,"ACCEPTED")).rejects.toThrow("outbox unavailable");
    failEvents=false;expect((await state(c.id)).member_count).toBe(1);
    expect(await chat.access(pool,c.conversationId,member)).toBeNull();
    expect((await communities.listInvitations(member,{limit:10,status:"PENDING"})).invitations).toHaveLength(1);
  });
  test("invitation cursor pagination and migration reapplication are stable",async()=>{
    for(let i=0;i<3;i++){const c=await create();await communities.invite(owner,c.id,member);}
    const first=await communities.listInvitations(member,{limit:2,status:"PENDING"});
    const next=await communities.listInvitations(member,{limit:2,status:"PENDING",cursor:first.pagination.nextCursor});
    expect(first.pagination.hasMore).toBe(true);expect(next.pagination.hasMore).toBe(false);
    expect(new Set([...first.invitations,...next.invitations].map(x=>x.id)).size).toBe(3);
    await pool.query(migration("091_community_invitations.sql"));
    const c=await create(),r=await communities.invite(owner,c.id,other);
    await expect(pool.query("INSERT INTO community.community_member_request(community_id,request_type,request_by,target_user_id,status) VALUES($1,'INVITE',$2,$3,'PENDING')",[c.id,owner,other])).rejects.toMatchObject({code:"23505"});
    expect(r.invitation.status).toBe("PENDING");
  });
  test("direct and group chat access is preserved by community migration",async()=>{
    const {rows:[direct]}=await pool.query("INSERT INTO chat.conversations(conversation_type,request_status) VALUES('direct','ACCEPTED') RETURNING id");
    await pool.query("INSERT INTO chat.conversation_participants VALUES($1,$2,NULL),($1,$3,NULL)",[direct.id,owner,member]);
    expect(await chat.access(pool,direct.id,member)).toMatchObject({can_send:true});
    const {rows:[g]}=await pool.query("INSERT INTO groups.groups(status) VALUES('ACTIVE') RETURNING id");
    await pool.query("INSERT INTO groups.group_members(group_id,user_id,status) VALUES($1,$2,'ACTIVE')",[g.id,member]);
    const {rows:[conv]}=await pool.query("INSERT INTO chat.conversations(conversation_type,group_id,request_status) VALUES('group',$1,'ACCEPTED') RETURNING id",[g.id]);
    expect(await chat.access(pool,conv.id,member)).toMatchObject({can_send:true});
    expect((await pool.query("SELECT * FROM chat.accessible_conversations($1)",[member])).rows).toHaveLength(2);
  });
});
