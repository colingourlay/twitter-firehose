const range = require('just-range');
const { BigInteger } = require('jsbn');

`
Snowflake ID (bytes) Breakdown
==============================

| 00011110100010001101110000010010101110011 | 01011 | 11000 | 000000000001 |
| T (41)                                    | D (5) | M (5) | S (12)       |
| T                                         | W (10)        | S            |

T = Time (ms) since Snowflake EPOCH
D = Data Center ID
M = Machine ID 
W = Worker ID (D&M)
S = Sequence ID
`;

`
Analysis of Tweet Sequence IDs
==============================

S  | Tweet % | Cumulative %
0  | 0.49815 | 0.49815 
1  | 0.26266 | 0.76080 
2  | 0.12046 | 0.88126 
6  | 0.04343 | 0.92469 
5  | 0.02783 | 0.95252 
3  | 0.02588 | 0.97839 
7  | 0.00747 | 0.98586 
4  | 0.00735 | 0.99321
8  | 0.00304 | 0.99625 
10 | 0.00109 | 0.99734
`;

const DEFAULT_SEQUENCE_IDS = [0, 1, 2, 6, 5, 3, 7, 4, 8, 10];

`
Analysis of Tweet Worker IDs
==============================
W   | Tweet % | Cumulative %
332 | 0.09057 | 0.09057
335 | 0.05927 | 0.14984
361 | 0.05724 | 0.20707
363 | 0.05452 | 0.26159
381 | 0.05406 | 0.31565
364 | 0.05378 | 0.36944
382 | 0.05344 | 0.42288
372 | 0.05341 | 0.47629
362 | 0.05263 | 0.52892
376 | 0.05247 | 0.58139
375 | 0.05174 | 0.63312
350 | 0.05145 | 0.68458
365 | 0.04923 | 0.73380
325 | 0.04076 | 0.77456
347 | 0.03860 | 0.81317
326 | 0.03855 | 0.85172
336 | 0.03748 | 0.88920
333 | 0.03660 | 0.92581
327 | 0.03576 | 0.96157
342 | 0.03453 | 0.99610
`;
const DEFAULT_WORKER_IDS = [
  375,
  382,
  361,
  372,
  364,
  381,
  376,
  365,
  363,
  362,
  350,
  325,
  335,
  333,
  342,
  326,
  327,
  336,
  347,
  332
];

const CREATION_TIME_EPOCH = new BigInteger('1288834974657');
const CREATION_TIME_SHIFT_PLACES = 22;
const DATA_CENTER_ID_SHIFT_PLACES = 17;
const MACHINE_ID_SHIFT_PLACES = 12;
const WORKER_ID_SHIFT_PLACES = 12;
const DATA_CENTER_ID_BIT_MASK = new BigInteger('31');
const MACHINE_ID_BIT_MASK = new BigInteger('31');
const SEQUENCE_ID_BIT_MASK = new BigInteger('4095');
const WORKER_ID_BIT_MASK = new BigInteger('1023');

const getCreationTime = id =>
  new BigInteger(id)
    .shiftRight(CREATION_TIME_SHIFT_PLACES)
    .add(CREATION_TIME_EPOCH)
    .toString();
const getDataCenterId = id =>
  new BigInteger(id)
    .shiftRight(DATA_CENTER_ID_SHIFT_PLACES)
    .and(DATA_CENTER_ID_BIT_MASK)
    .toString();
const getMachineId = id =>
  new BigInteger(id)
    .shiftRight(MACHINE_ID_SHIFT_PLACES)
    .and(MACHINE_ID_BIT_MASK)
    .toString();
const getSequenceId = id => new BigInteger(id).and(SEQUENCE_ID_BIT_MASK).toString();
const getWorkerId = id =>
  new BigInteger(id)
    .shiftRight(WORKER_ID_SHIFT_PLACES)
    .and(WORKER_ID_BIT_MASK)
    .toString();

const getComponents = id => ({
  creationTime: getCreationTime(id),
  dataCenterId: getDataCenterId(id),
  machineId: getMachineId(id),
  sequenceId: getSequenceId(id),
  workerId: getWorkerId(id)
});

const generateId = (creationTime, workerId, sequenceId) =>
  new BigInteger(creationTime)
    .subtract(CREATION_TIME_EPOCH)
    .shiftLeft(CREATION_TIME_SHIFT_PLACES)
    .add(new BigInteger(workerId).shiftLeft(WORKER_ID_SHIFT_PLACES))
    .add(new BigInteger(sequenceId))
    .toString();

const generateIdRange = (from, to, workerIds = DEFAULT_WORKER_IDS, sequenceIds = DEFAULT_SEQUENCE_IDS) => {
  if (typeof from !== 'number') {
    throw new Error(`'from' must be a Number`);
  }

  const creationTimes = typeof to === 'number' && to > from ? range(from, to) : [from];
  const ids = [];

  creationTimes.forEach(creationTime => {
    workerIds.forEach(workerId => {
      sequenceIds.forEach(sequenceId => {
        ids.push(generateId(String(creationTime), String(workerId), String(sequenceId)));
      });
    });
  });

  return ids;
};

module.exports = {
  CREATION_TIME_EPOCH,
  generateId,
  generateIdRange,
  getComponents,
  getCreationTime,
  getDataCenterId,
  getMachineId,
  getSequenceId,
  getWorkerId
};
