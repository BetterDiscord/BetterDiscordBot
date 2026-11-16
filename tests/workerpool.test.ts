import {expect, test} from "bun:test";
import {JobTimeoutError, WorkerPool} from "../src/util/workerpool";


interface FakeWorker {
    id: number;
    isStopped: boolean;
}

function createPool(size: number, {failStarts = 0} = {}) {
    const workers: FakeWorker[] = [];
    let failuresLeft = failStarts;
    const pool = new WorkerPool<FakeWorker>({
        size,
        start: () => {
            if (failuresLeft-- > 0) return Promise.reject(new Error("could not start"));
            const worker = {id: workers.length + 1, isStopped: false};
            workers.push(worker);
            return Promise.resolve(worker);
        },
        stop: worker => {
            worker.isStopped = true;
            return Promise.resolve();
        },
    });
    return {pool, workers};
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const never = () => new Promise<never>(() => {});
const done = () => Promise.resolve("done");
const workerId = (worker: FakeWorker) => Promise.resolve(worker.id);

test("a pool that is never used starts no workers", () => {
    const {workers} = createPool(2);
    expect(workers.length).toBe(0);
});

test("a job gets a worker and its result comes back", async () => {
    const {pool, workers} = createPool(1);
    const {result} = await pool.run(workerId, 1000);
    expect(result).toBe(1);
    expect(workers.length).toBe(1);
});

test("a worker is reused for the next job", async () => {
    const {pool, workers} = createPool(1);
    await pool.run(done, 1000);
    await pool.run(done, 1000);
    expect(workers.length).toBe(1);
});

test("jobs beyond the pool size wait and then run in the order they arrived", async () => {
    const {pool, workers} = createPool(1);
    const order: string[] = [];
    const job = (name: string) => async () => {
        order.push(`${name} starts`);
        await sleep(20);
        order.push(`${name} ends`);
    };

    const results = await Promise.all([pool.run(job("a"), 1000), pool.run(job("b"), 1000), pool.run(job("c"), 1000)]);

    expect(order).toEqual(["a starts", "a ends", "b starts", "b ends", "c starts", "c ends"]);
    expect(workers.length).toBe(1);
    expect(results[0].waited).toBeLessThan(15);
    expect(results[2].waited).toBeGreaterThanOrEqual(35);
});

test("a pool of two runs two jobs at the same time", async () => {
    const {pool, workers} = createPool(2);
    let running = 0;
    let mostRunning = 0;
    const job = async () => {
        mostRunning = Math.max(mostRunning, ++running);
        await sleep(20);
        running--;
    };

    await Promise.all([pool.run(job, 1000), pool.run(job, 1000), pool.run(job, 1000)]);

    expect(mostRunning).toBe(2);
    expect(workers.length).toBe(2);
});

test("a job that fails rejects, and its worker is kept", async () => {
    const {pool, workers} = createPool(1);
    expect(pool.run(() => Promise.reject(new Error("bad image")), 1000)).rejects.toThrow("bad image");
    await pool.run(done, 1000);
    expect(workers.length).toBe(1);
    expect(workers[0].isStopped).toBe(false);
});

test("a job that takes too long rejects, and its worker is stopped and replaced", async () => {
    const {pool, workers} = createPool(1);
    expect(pool.run(never, 20)).rejects.toBeInstanceOf(JobTimeoutError);
    await sleep(40);
    expect(workers[0].isStopped).toBe(true);

    const {result} = await pool.run(workerId, 1000);
    expect(result).toBe(2);
});

test("a job waiting behind one that times out still runs", async () => {
    const {pool, workers} = createPool(1);
    const stuck = pool.run(never, 20);
    const next = pool.run(workerId, 1000);

    expect(stuck).rejects.toBeInstanceOf(JobTimeoutError);
    expect((await next).result).toBe(2);
    expect(workers.map(w => w.isStopped)).toEqual([true, false]);
});

test("a worker that fails to start rejects the job, and the next job tries again", async () => {
    const {pool, workers} = createPool(1, {failStarts: 1});
    expect(pool.run(done, 1000)).rejects.toThrow("could not start");
    await sleep(5);

    const {result} = await pool.run(workerId, 1000);
    expect(result).toBe(1);
    expect(workers.length).toBe(1);
});
