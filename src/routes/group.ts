import { Request, Response, Router } from 'express';
import prisma from '../db.js';

const group = Router()

group.get('/:group_id', (req: Request, res: Response) => {
    const g = prisma.group.findUnique({
        where: {
            id: req.params.id
        }
    })
    res.json(g)
})
interface create_group {
    name: string;
    members: { id: string, name: string, email:string }[];
}
group.post('/', (req: Request, res: Response) => {
    const g: create_group = req.body
    const members = g.members.map(id => { connect: { id } })
    console.log(members)
    const created_group = prisma.group.create({
        data: {
            name: g.name,
            members: {
                createMany: {
                    data: members
                }
            }
        },
    })
    console.log(created_group)
    res.json()
})

group.route('/:id/members')
    .get((req: Request, res: Response) => {
        
    })
    .post((req: Request, res: Response) => {
        
    })
group.route('/:id/expenses')
    .get((req: Request, res: Response) => {
        
    })
    .post((req: Request, res: Response) => {
        
    })
group.route('/:id/payments')
    .get((req: Request, res: Response) => {
        
    })
    .post((req: Request, res: Response) => {
        
    })

export default group