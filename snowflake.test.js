const assert = require('assert');
const { getComponents, generateId } = require('./snowflake');

const id = '1101668899018334209';
const { creationTime, sequenceId, workerId } = getComponents(id);
const generatedId = generateId(creationTime, workerId, sequenceId);

assert(generatedId == id);
