import redis from 'redis';
import chai from 'chai';
import { promisify } from 'util';
import redisClient from './utils/redis.js';


describe('redisClient test', () => {
    let testRedisClient;
    let redisDelAsync;
    let redisSetAsync;

    beforeEach((done) => {
        testRedisClient = redis.createClient();
        redisDelAsync = promisify(testRedisClient.del).bind(testRedisClient);
        redisSetAsync = promisify(testRedisClient.set).bind(testRedisClient);
        testRedisClient.on('connect', async () => {
            await redisSetAsync('myCheckerKey', 89);
            done()
        });
    });
    
    afterEach(async () => {
        await redisDelAsync('myCheckerKey');
    });

    it('get of existing key', async () => {
        const kv = await redisClient.get('myCheckerKey');
        chai.assert.exists(kv);
        chai.assert.equal(kv, 89)
    });
});