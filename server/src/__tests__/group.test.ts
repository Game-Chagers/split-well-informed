
// 1. Tell Jest to mock the Prisma library
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      group: {
        create: jest.fn().mockResolvedValue({
          id: 99,
          name: 'Test Group',
          members: [{ id: 1 }, { id: 2 }]
        }),
      },
    })),
  };
});

describe('POST /api/groups', () => {
  it('should create a new group and return 201', async () => {
  });

  it('should return 400 if memberIds is not an array', async () => {
  });
});