import test from 'node:test';
import assert from 'node:assert/strict';
import {NoticeQueue,noticeDuration,classifyNotice} from '../../src/shared/notices';
test('urgent events preempt ordinary events without losing them, FIFO within priority',()=>{
 const q=new NoticeQueue();
 const first=q.add({message:'Первое'},0)!;assert.equal(q.take(),first);
 const next=q.add({message:'Второе'},10)!;
 const urgent=q.add({message:'Срочно',kind:'urgent'},20)!;
 assert.ok(q.outranks(urgent,first));q.requeue(first);
 assert.equal(q.take(),urgent);assert.equal(q.take(),first);assert.equal(q.take(),next);
 assert.equal(q.history.length,3);assert.equal(q.unread,3);
 q.read();assert.equal(q.unread,0);assert.equal(q.history.length,3);
});
test('duplicates are suppressed, independent events kept and history bounded',()=>{
 const q=new NoticeQueue();q.add({message:'Готово'},0);
 assert.equal(q.add({message:'Готово'},100),undefined);
 assert.ok(q.add({message:'Готово'},4001));
 for(let i=0;i<100;i++)q.add({message:'Событие '+i},5000+i);
 assert.equal(q.history.length,80);assert.ok(q.pending.length<=80);
 q.clear();assert.equal(q.history.length,0);assert.equal(q.pending.length,0);
});
test('important events have navigation and longer duration',()=>{
 assert.equal(classifyNotice('🎉 Сегодня: Новый год').target,'holidays');
 assert.equal(classifyNotice('Симба плохо себя чувствует').target,'pets');
 assert.equal(classifyNotice('Не хватило денег, задолженность').target,'finance');
 const q=new NoticeQueue();
 const a=q.add({message:'Обычное'},0)!;const b=q.add({message:'Срочно',kind:'urgent'},1)!;
 assert.ok(noticeDuration(b)>noticeDuration(a));
});

test('resolved connection warnings leave the live queue but remain in history',()=>{
 const q=new NoticeQueue();const warning=q.add({message:'Связь потеряна',key:'disconnect',kind:'urgent'},0)!;
 const unrelated=q.add({message:'Другое событие'},1)!;
 q.resolve('disconnect');assert.equal(q.take(),unrelated);assert.equal(q.take(),undefined);
 assert.ok(q.history.includes(warning));assert.equal(q.unread,2);
 assert.ok(q.add({message:'Связь потеряна',key:'disconnect',kind:'urgent'},2));
});
