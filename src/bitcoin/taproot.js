const logger = require('../logger')
const Database = require('better-sqlite3');
const { formatDate } = require('../formatDate')
const getStatistics = require('./taproot_transactions')

module.exports = function(bitcoin_rpc) {

  const db = new Database('taproot.sqlite', { info: console.log })

  const beginTransaction = db.prepare('BEGIN TRANSACTION')
  const commitTransaction = db.prepare('COMMIT')
  const rollbackTransaction = db.prepare('ROLLBACK')
  
  db.pragma('journal_mode=WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS block (
      height INTEGER NOT NULL UNIQUE,
      time INTEGER NOT NULL,
      weight INTEGER NOT NULL,
      hash BINARY NOT NULL
    )`)

  db.exec(`CREATE INDEX IF NOT EXISTS time_idx ON block (time)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS stats (
      height INTEGER NOT NULL,
      type TEXT NOT NULL,
      desc TEXT NOT NULL,
      count INTEGER,
      size INTEGER,
      value INTEGER,
      FOREIGN KEY (height) REFERENCES block(height)
    )`)

  db.exec(`CREATE INDEX IF NOT EXISTS block_idx ON stats (height)`);

  db.pragma('wal_checkpoint')

  const insertBlock = db.prepare(`
    INSERT INTO block(height, time, weight, hash) 
    VALUES ($height, $time, $weight, $hash)
    `)
  const insertStats = db.prepare(`
    INSERT INTO stats(height, type, desc, count, size, value) 
    VALUES ($height, $type, $desc, $count, $size, $value)
    `)

  const selectTransactions = db.prepare(`
    SELECT type, desc, sum(count) as count, sum(value) as value
    FROM stats JOIN block ON stats.height = block.height 
    WHERE block.time between $from and $until 
    AND type in ('in', 'out')
    GROUP BY type, desc
    `)

  this.init = async () => {

    const currentHeight = db.prepare(`SELECT max(height) FROM block`).pluck().get()
    
    const bestBlockHash = await bitcoin_rpc.getBestBlockHash()
    const bestBlockHeader = await bitcoin_rpc.getBlockHeader(bestBlockHash)
    const bestBlockHeight = bestBlockHeader.height
    
    for (var height = currentHeight + 1; height <= bestBlockHeight; height++) {
      if (!rows.has(height)) {
        try {
          const blockHash = await bitcoin_rpc.getBlockHash(height)
          processBlockHash(blockHash)
        }
        catch (error)
        {
          rollbackTransaction.run()
          console.log(error)
          process.exit(-1)
        }
      }
      if (height % 100 == 0) {
        logger.log(`Block ${height}`)
        db.pragma('wal_checkpoint')
      }
    }
  }

  db.pragma('wal_checkpoint')

  this.onBlockHeader = async (blockHeader) => {
    processBlockHash(blockHeader.hash)

    db.pragma('wal_checkpoint')
  }

  async function processBlockHash(hash) {
    const block = await bitcoin_rpc.getBlock(hash, 3)

    const statistics = getStatistics(block)

    beginTransaction.run()

    insertBlock.run({height: block.height, time: block.time, weight: block.weight, hash: Buffer.from(block.hash, 'hex')})

    for (const [key, {count, value}] of Object.entries(statistics.ins)) {
      if (count != 0 || value != 0) {
        insertStats.run({height: block.height, type: 'in', desc: key, count: count, size: null, value: (value * 1e8).toFixed(0)})
      }
    }

    for (const [key, {count, value}] of Object.entries(statistics.outs)) {
      if (count != 0 || value != 0) {
        insertStats.run({height: block.height, type: 'out', desc: key, count: count, size: null, value: (value * 1e8).toFixed(0)})
      }
    }

    for (const [key, {count, size}] of Object.entries(statistics.kinds)) {
      insertStats.run({height: block.height, type: 'kind', desc: key, count: count, size: size, value: null})
    }

    for (const [key, {count, size}] of Object.entries(statistics.inscriptions)) {
      insertStats.run({height: block.height, type: 'inscription', desc: key, count: count, size: size, value: null})
    }

    for (const [key, {count, size}] of Object.entries(statistics.brc20s)) {
      insertStats.run({height: block.height, type: 'brc20', desc: key, count: count, size: size, value: null})          
    }

    commitTransaction.run()
  }

  this.getTransactions = function(date) {
    var from = new Date(date)
    var until = new Date(date)
    until.setDate(from.getDate() + 1)
    return selectTransactions.all({from: from.getTime() / 1000, until: until.getTime() / 1000});
  }
}

// select type, desc, count(*), sum(count), sum(size), sum(value) from stats join block on stats.height=block.height where block.time between 1276293600 and 1276380000 group by type, desc;