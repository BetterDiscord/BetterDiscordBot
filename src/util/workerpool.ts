interface WorkerPoolOptions<W> {
    /** The most workers that exist at once. */
    size: number;
    start: () => Promise<W>;
    stop: (worker: W) => Promise<unknown>;
}

interface Waiter<W> {
    resolve: (worker: W) => void;
    reject: (error: unknown) => void;
}

export class JobTimeoutError extends Error {
    constructor(timeout: number) {
        super(`Job did not finish within ${timeout} ms`);
        this.name = "JobTimeoutError";
    }
}

export interface JobResult<R> {
    result: R;
    /** How long the job waited for a free worker (in milliseconds) */
    waited: number;
}

/**
 * Runs jobs on a fixed number of workers, one job per worker at a time. Jobs beyond that wait in line.
 * Workers start the first time they are needed, so a pool that is never used costs nothing.
 */
export class WorkerPool<W> {
    private idle: W[] = [];
    private waiting: Array<Waiter<W>> = [];
    private workerCount = 0;

    constructor(private options: WorkerPoolOptions<W>) {}

    /**
     * Runs `job` on the next free worker. If the job takes longer than `timeout`, this rejects with a
     * `JobTimeoutError`, and the worker is stopped and replaced, because a job that is stuck cannot be cancelled.
     */
    async run<R>(job: (worker: W) => Promise<R>, timeout: number): Promise<JobResult<R>> {
        const queuedAt = performance.now();
        const worker = await this.acquire();
        const waited = performance.now() - queuedAt;

        let timer: ReturnType<typeof setTimeout> | undefined;
        const timedOut = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new JobTimeoutError(timeout)), timeout);
        });

        try {
            const result = await Promise.race([job(worker), timedOut]);
            this.release(worker);
            return {result, waited};
        }
        catch (error) {
            // A job that failed by itself leaves its worker usable, but one that timed out may still be running
            if (error instanceof JobTimeoutError) this.discard(worker);
            else this.release(worker);
            throw error;
        }
        finally {
            clearTimeout(timer);
        }
    }

    private async acquire(): Promise<W> {
        const worker = this.idle.pop();
        if (worker) return worker;
        if (this.workerCount < this.options.size) return await this.startWorker();
        return await new Promise<W>((resolve, reject) => this.waiting.push({resolve, reject}));
    }

    private async startWorker(): Promise<W> {
        this.workerCount++;
        try {
            return await this.options.start();
        }
        catch (error) {
            this.workerCount--;
            throw error;
        }
    }

    private release(worker: W) {
        const next = this.waiting.shift();
        if (next) next.resolve(worker);
        else this.idle.push(worker);
    }

    private discard(worker: W) {
        this.workerCount--;
        this.options.stop(worker).catch(() => {});

        // The discarded worker will never be released, so the next job in line needs a new one
        const next = this.waiting.shift();
        if (next) this.startWorker().then(next.resolve, next.reject);
    }
}
