export const sleep = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

export function getRandom(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

export function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min)) + min;
}

export function randomArrayWithSum(length: number, sum: number, min: number, max: number) {
    let remaining = sum;
    const results: number[] = [];
    for(let i = 0; i < length - 1; i++) {
        const rand = getRandomInt(min, max);
        const amount = Math.min(remaining, rand);
        remaining -= amount;
        results.push(amount)
    }
    results.push(remaining);
    return results;
}