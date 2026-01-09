import { Request, Response, Router } from 'express';
import { prisma } from '../db';

const group = Router()

group.get('/:group_id', (req: Request, res: Response) => {
    const g = prisma.Group.findUnique({
        where: {
            id: req.params.id
        }
    })
    res.json(g)
})
interface create_group {
    name: string;
    members: string[];
    tentativeMem: string[];
}
group.post('/', (req: Request, res: Response) => {
    const g: create_group = req.body
    const members = g.members.map(id => { connect: { id } })
    members.concat(g.tentativeMem.map(name => { name }))
    console.log(members)
    const created_group = prisma.Group.create({
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