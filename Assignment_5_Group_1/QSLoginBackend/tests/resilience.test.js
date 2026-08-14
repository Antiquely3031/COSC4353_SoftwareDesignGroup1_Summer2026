const request = require('supertest');
const app = require('../app');
const db = require('../db');

afterAll(async () => {
    await db.closePool();
});

describe('Database resilience', () => {
    test('returns a clean 500 error when the database throws, instead of crashing', async () => {
        const original = db.findUserByEmail;
        db.findUserByEmail = async () => {
            throw new Error('Connection was lost: ECONNREFUSED');
    };

    const res = await request(app)
        .post('/api/login')
        .send({email: 'anyone@test.com', password: 'testpass123'});
    
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBeDefined();
    expect(res.body.error).not.toMatch(/ECONNREFUSED/);

    db.findUserByEmail = original;
    });

    test('signup also fails if database is unreachable', async () => {
        const original = db.createUser;
        db.createUser = async () => {
            throw new Error('Connection lost: ECONNREFUSED');
        };

        const res = await request(app)
            .post('/api/signup')
            .send({name: 'Test', email: 'resilience@test.com', password: 'testpass123'});
        
        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBeDefined();

        db.createUser = original;
    });
});

describe('Concurrent request handling', () => {
    test('handles multiple simultaneous login attempts without crashing', async () => {
        await db.deleteUserByEmail('concurrent@test.com');
        await request(app).post('/api/signup')
            .send({name: 'Concurrent', email: 'concurrent@test.com', password: 'testpass123'});
        
        const requests = Array.from({length: 10}, () =>
            request(app).post('/api/login')
                .send({email: 'concurrent@test.com', password: 'testpass123'})
        );

        const results = await Promise.all(requests);

        results.forEach(res => {
            expect(res.statusCode).toBe(200);
        });

        await db.deleteUserByEmail('concurrent@test.com');
    });
});

