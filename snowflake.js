const range = require('just-range');
const { BigInteger } = require('jsbn');

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

const DEFAULT_SEQUENCE_IDS = [0, 1, 2, 6, 5, 3, 7, 4, 8, 10];
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
