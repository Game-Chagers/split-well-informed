import request from 'supertest'
import { validate as uuidValidateV4 } from 'uuid'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import app from '../app.js'
import prisma from '../db.js'
import clear_columns from './clear.js'

// call create group and ensure a 
// Group is created along with a group member and connects a user

describe('/group.post', ()=> {
    beforeEach(async () => {
        clear_columns()
    })
    afterEach(async ()=> {
        const created_group = await prisma.group.findFirst()
        expect(created_group).not.toBeNull();
        expect(created_group).toHaveProperty('id');
        expect(uuidValidateV4(created_group)).toBe(true)
        expect(created_group).toHaveProperty('name');
    })
    it('creates group with no members', async ()=>{
        const res = await request(app)
        .post('/group')
        .send(JSON.stringify({
            name: 'group_test_name'
        }))
        .expect('Content-Type', /json/)
        .expect(201)
        

        const new_group = await prisma.group.findUnique({
            where: { id: res.body.id },
            include: { members: true }
        });
        
        expect(new_group?.members).toHaveLength(0)
    })
    it('creates group with one member without user', async ()=>{
        const res = await request(app)
        .post('/group')
        .send(JSON.stringify({
            name: 'group_test_name'
        }))
        .expect('Content-Type', /json/)
        .expect(201)


        const new_group = await prisma.group.findUnique({
            where: { id: res.body.id },
            include: { 
                members: {
                    include: {
                        user: true
                    }
                } 
            }
        });
        
        expect(new_group?.members).toHaveLength(1)
        const member = new_group?.members[0]
        expect(member).toHaveProperty('userId')
        expect(member).toHaveProperty('user')
        const user = member?.user
        expect(user).not.toHaveProperty('email')
    })
    it('creates group with one member via cookie with user', async ()=>{
        const test_user = await prisma.user.create({
            data: { name: 'test_user_for_group', email: 'test_user_for_group@test.com'}
        })
        const res = await request(app)
        .post('/group')
        .set('Cookie', [`id=${test_user.id}`])
        .send(JSON.stringify({
            name: 'group_test_name'
        }))
        .expect('Content-Type', /json/)
        .expect(201)

        expect(res.body).toHaveProperty('id')
        expect(uuidValidateV4(res.body.id)).toBe(true)

        const new_group = await prisma.group.findUnique({
            where: { id: res.body.id },
            include: { 
                members: {
                    include: {
                        user: true
                    }
                } 
            }
        });
        
        expect(new_group?.members).toHaveLength(1)
        const member = new_group?.members[0]
        expect(member?.userId).toBe(test_user.id)
        expect(member).toHaveProperty('user')
        expect(member?.user?.id).toBe(test_user.id)
    })
    // it('', async ()=>{
        
    // })
})