import {jest} from '@jest/globals';
import pg from 'pg';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {userInfo} from 'node:os';
import {randomUUID} from 'node:crypto';
let directory,pool,user,other,lesson;
const db={query:(...args)=>pool.query(...args),transaction:async fn=>{
  const client=await pool.connect();
  try{await client.query('BEGIN');const value=await fn(client);await client.query('COMMIT');return value;}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}};
jest.unstable_mockModule('../../../src/database/database-manager.js',()=>({default:db}));
const {default:repository}=await import('../../../src/modules/lingua/lingua.repository.js');
const {linguaContentSchema}=await import('../../../src/modules/lingua/lingua-content.schema.js');

(process.env.RUN_LINGUA_DB_TESTS==='1'?describe:describe.skip)('LinguaTrail isolated PostgreSQL',()=>{
  beforeAll(async()=>{
    directory=mkdtempSync('/tmp/artictern-lingua-');
    execFileSync('initdb',['-D',`${directory}/data`,'--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});
    execFileSync('pg_ctl',['-D',`${directory}/data`,'-l',`${directory}/pg.log`,'-o',`-k ${directory} -h ''`,'-w','start'],{stdio:'pipe'});
    pool=new pg.Pool({host:directory,user:userInfo().username,database:'postgres'});
    await pool.query(`CREATE SCHEMA auth;CREATE SCHEMA poi;CREATE SCHEMA media;CREATE SCHEMA itinerary;CREATE SCHEMA groups;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE TABLE poi.countries(id uuid PRIMARY KEY,name text,code text,is_active boolean DEFAULT true);
      CREATE TABLE poi.cities(id uuid PRIMARY KEY,country_id uuid,provider text,provider_id text,is_active boolean DEFAULT true);
      CREATE TABLE media.assets(id uuid PRIMARY KEY,mime_type text,deleted_at timestamptz,is_public boolean);
      CREATE TABLE itinerary.itineraries(id uuid PRIMARY KEY,created_by uuid,deleted_at timestamptz,itinerary_json jsonb);
      CREATE TABLE groups.groups(id uuid PRIMARY KEY,itinerary_id uuid,status text,deleted_at timestamptz);
      CREATE TABLE groups.group_members(group_id uuid,user_id uuid,status text);
      CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.updated_at=CURRENT_TIMESTAMP;RETURN NEW;END$$;`);
    await pool.query(readFileSync(new URL('../../../src/database/migrations/073_create_lingua_trail.sql',import.meta.url),'utf8'));
    user=randomUUID();other=randomUUID();await pool.query('INSERT INTO auth.users VALUES($1),($2)',[user,other]);
    const content=linguaContentSchema.parse(JSON.parse(readFileSync(new URL('../../../content/lingua/fr.json',import.meta.url),'utf8')));
    const language=(await pool.query("SELECT id FROM lingua.languages WHERE code='fr'")).rows[0].id;
    for(const source of content.lessons){
      const id=(await pool.query('INSERT INTO lingua.lessons(language_id,stable_key,title,topic,display_order) VALUES($1,$2,$3,$4,$5) RETURNING id',[language,source.stableKey,source.title,source.topic,source.displayOrder])).rows[0].id;
      lesson??=id;
      for(const phrase of source.phrases){
        const phraseId=(await pool.query('INSERT INTO lingua.phrases(lesson_id,stable_key,target_text,english_meaning,display_order) VALUES($1,$2,$3,$4,$5) RETURNING id',[id,phrase.stableKey,phrase.targetText,phrase.englishMeaning,phrase.displayOrder])).rows[0].id;
        const question=(await pool.query('INSERT INTO lingua.questions(phrase_id,question_type,prompt,explanation) VALUES($1,$2,$3,$4) RETURNING id',[phraseId,phrase.question.type,phrase.question.prompt,phrase.question.explanation])).rows[0].id;
        for(const option of phrase.question.options)await pool.query('INSERT INTO lingua.question_options(question_id,stable_key,option_text,is_correct,display_order) VALUES($1,$2,$3,$4,$5)',[question,option.stableKey,option.text,option.correct,option.displayOrder]);
      }
      await pool.query('SELECT lingua.publish_lesson($1)',[id]);
    }
    await pool.query("UPDATE lingua.languages SET status='PUBLISHED' WHERE id=$1",[language]);
  },30000);
  afterAll(async()=>{await pool?.end();if(directory){try{execFileSync('pg_ctl',['-D',`${directory}/data`,'-m','fast','-w','stop'],{stdio:'pipe'});}finally{rmSync(directory,{recursive:true,force:true});}}});
  beforeEach(async()=>{await pool.query('TRUNCATE lingua.attempts CASCADE');});
  test('migration and publication expose only the published pack and five cards',async()=>{
    expect(await repository.listPublishedLanguages()).toHaveLength(1);
    expect(await repository.listLessonCards(lesson)).toHaveLength(5);
    await expect(pool.query("UPDATE lingua.phrases SET target_text='changed' WHERE lesson_id=$1",[lesson])).rejects.toMatchObject({code:'23514'});
  });
  test('parallel starts resume one persistent shuffled attempt; another user cannot read it',async()=>{
    const results=await Promise.all(Array.from({length:6},()=>repository.startOrResumeAttempt({lessonId:lesson,userId:user,retry:false})));
    expect(new Set(results.map(r=>r.attemptId)).size).toBe(1);
    expect(results.filter(r=>r.created)).toHaveLength(1);
    expect(await repository.findOwnedAttempt(results[0].attemptId,other)).toBeNull();
    const questions=await repository.listOwnedAttemptQuestions(results[0].attemptId,user);
    expect(questions).toHaveLength(15);
    expect(questions.every(q=>q.correct_option_id===null)).toBe(true);
  });
  test('first answer is immutable and practice never overwrites it',async()=>{
    const {attemptId}=await repository.startOrResumeAttempt({lessonId:lesson,userId:user});
    const q=(await repository.listOwnedAttemptQuestions(attemptId,user))[0];
    const options=(await pool.query('SELECT id,is_correct FROM lingua.question_options WHERE question_id=$1',[q.question_id])).rows;
    const wrong=options.find(o=>!o.is_correct).id,correct=options.find(o=>o.is_correct).id;
    const send=(optionId,mode='QUIZ')=>repository.submitAnswer({attemptId,questionId:q.question_id,optionId,userId:user,mode});
    expect((await send(wrong)).persisted).toBe(true);
    expect((await send(wrong)).idempotent).toBe(true);
    expect(await send(correct)).toEqual({error:'ANSWER_ALREADY_SUBMITTED'});
    expect((await send(correct,'PRACTICE')).persisted).toBe(false);
    expect((await pool.query('SELECT selected_option_id FROM lingua.attempt_answers WHERE attempt_id=$1',[attemptId])).rows[0].selected_option_id).toBe(wrong);
    expect((await repository.finishAttempt({attemptId,userId:user})).error).toBe('ATTEMPT_INCOMPLETE');
  });
  test('finish scores five answers server-side and retries require an explicit flag',async()=>{
    const {attemptId}=await repository.startOrResumeAttempt({lessonId:lesson,userId:user});
    const questions=(await pool.query('SELECT q.id,o.id AS option_id FROM lingua.questions q JOIN lingua.phrases p ON p.id=q.phrase_id JOIN lingua.question_options o ON o.question_id=q.id AND o.is_correct WHERE p.lesson_id=$1',[lesson])).rows;
    for(const q of questions)await repository.submitAnswer({attemptId,questionId:q.id,optionId:q.option_id,userId:user,mode:'QUIZ'});
    expect(await repository.finishAttempt({attemptId,userId:user})).toMatchObject({updated:true,correctCount:5,questionCount:5});
    expect(await repository.finishAttempt({attemptId,userId:user})).toMatchObject({updated:false,correctCount:5});
    expect(await repository.startOrResumeAttempt({lessonId:lesson,userId:user,retry:false})).toEqual({error:'RETRY_REQUIRED'});
    expect((await repository.startOrResumeAttempt({lessonId:lesson,userId:user,retry:true})).created).toBe(true);
  });
  test('all ten content packs satisfy the publishing schema without publishing drafts',()=>{
    for(const code of ['fr','es','en','it','tr','de','ja','th','pt','ar'])expect(linguaContentSchema.safeParse(JSON.parse(readFileSync(new URL(`../../../content/lingua/${code}.json`,import.meta.url),'utf8'))).success).toBe(true);
  });
});
