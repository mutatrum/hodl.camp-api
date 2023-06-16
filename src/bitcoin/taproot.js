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
      height INTEGER PRIMARY KEY NOT NULL UNIQUE,
      time INTEGER NOT NULL,
      mediantime INTEGER NOT NULL,
      weight INTEGER NOT NULL,
      difficulty REAL NOT NULL,
      chainwork BINARY NOT NULL,
      hash BINARY NOT NULL
    )`)

  db.exec(`CREATE INDEX IF NOT EXISTS time_idx ON block (time)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS transaction_type (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name STRING NOT NULL UNIQUE
    )`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS transaction_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      height INTEGER NOT NULL REFERENCES block(height),
      transaction_type_id INTEGER NOT NULL REFERENCES transaction_type(id),
      is_output INTEGER NOT NULL,
      count INTEGER NOT NULL,
      value INTEGER NOT NULL
    )`)

  db.exec(`CREATE INDEX IF NOT EXISTS idx_transaction_stats_height ON transaction_stats (height)`);


  db.exec(`
    CREATE TABLE IF NOT EXISTS inscription_type (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name STRING NOT NULL UNIQUE
    )`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS inscription_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      height INTEGER NOT NULL REFERENCES block(height),
      inscription_type_id INTEGER NOT NULL REFERENCES inscription_type(id),
      count INTEGER NOT NULL,
      size INTEGER NOT NULL
    )`)

  db.exec(`CREATE INDEX IF NOT EXISTS idx_inscription_stats_height ON inscription_stats (height)`);


  db.exec(`
    CREATE TABLE IF NOT EXISTS ordinal_type (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name STRING NOT NULL UNIQUE
    )`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS ordinal_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      height INTEGER NOT NULL REFERENCES block(height),
      ordinal_type_id INTEGER NOT NULL REFERENCES ordinal_type(id),
      count INTEGER NOT NULL,
      size INTEGER NOT NULL
    )`)

  db.exec(`CREATE INDEX IF NOT EXISTS idx_ordinal_stats_height ON ordinal_stats (height)`);


  db.pragma('wal_checkpoint')

  const insertBlock = db.prepare(`
    INSERT INTO block(height, time, mediantime, weight, difficulty, chainwork, hash)
    VALUES ($height, $time, $mediantime, $weight, $difficulty, $chainwork, $hash)`)

  const insertTransactionType = db.prepare(`
    INSERT INTO transaction_type(name)
    VALUES ($name)`)

  const insertTransactionStats = db.prepare(`
    INSERT INTO transaction_stats(height, transaction_type_id, is_output, count, value)
    VALUES ($height, $transaction_type_id, $is_output, $count, $value)`)

  const insertInscriptionType = db.prepare(`
    INSERT INTO inscription_type(name)
    VALUES ($name)`)

  const insertInscriptionStats = db.prepare(`
    INSERT INTO inscription_stats(height, inscription_type_id, count, size)
    VALUES ($height, $inscription_type_id, $count, $size)`)

  const insertOrdinalType = db.prepare(`
    INSERT INTO ordinal_type(name)
    VALUES ($name)`)

  const insertOrdinalStats = db.prepare(`
    INSERT INTO ordinal_stats(height, ordinal_type_id, count, size)
    VALUES ($height, $ordinal_type_id, $count, $size)`)

  // const selectHeightRange = db.prepare(`
  //   SELECT MIN(height) as fromHeight, MAX(height) as untilHeight FROM block WHERE time BETWEEN $from AND $until
  //   `)

  // const selectTransactions = db.prepare(`
  //   SELECT type, desc, sum(count) as count, sum(value) as value
  //   FROM stats
  //   WHERE height BETWEEN $fromHeight AND $untilHeight
  //   AND type IN ('in', 'out')
  //   GROUP BY type, desc
  //   `)

  const transactionTypes = getTypes('transaction_type')
  const inscriptionTypes = getTypes('inscription_type')
  const ordinalTypes = getTypes('ordinal_type')

  this.init = async () => {

    const bestBlockHash = await bitcoin_rpc.getBestBlockHash()
    const bestBlockHeader = await bitcoin_rpc.getBlockHeader(bestBlockHash)
    const bestBlockHeight = bestBlockHeader.height

    const currentHeight = db.prepare(`SELECT max(height) FROM block`).pluck().get()
    var height = currentHeight ? currentHeight + 1 : 0

    var prevTime = Math.floor(Date.now() / 1000)
    var prevHeight = 0

    while (height <= bestBlockHeight) {
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
      var time = Math.floor(Date.now() / 1000)
      if (time != prevTime) {
        db.pragma('wal_checkpoint')
        logger.log(`Block ${height} (${height - prevHeight}/sec)`)
        prevHeight = height
        prevTime = time
      }
      height++
    }
  }

  db.pragma('wal_checkpoint')

  this.onBlockHeader = async (blockHeader) => {
    processBlockHash(blockHeader.hash)

    db.pragma('wal_checkpoint')
  }

  function getTypes(table_name) {
    const result = {}
    for (const row of db.prepare(`SELECT rowid,name FROM ${table_name}`).iterate())
      result[row.name] = row.id;
    return result
  }

  async function processBlockHash(hash) {
    const block = await bitcoin_rpc.getBlock(hash, 3)

    const statistics = getStatistics(block)

    beginTransaction.run()

    insertBlock.run({
      height: block.height,
      time: block.time,
      mediantime: block.mediantime,
      weight: block.weight,
      difficulty: block.difficulty,
      chainwork: Buffer.from(block.chainwork, 'hex'),
      hash: Buffer.from(block.hash, 'hex')
    })

    processTransactionStats(statistics.ins, block.height, 0)
    processTransactionStats(statistics.outs, block.height, 1)
    processInscriptionStats(statistics.inscriptions, block.height)
    processOrdinalStats(statistics.brc20s, block.height)

    commitTransaction.run()
  }

  function processTransactionStats(stats, height, is_output) {
    for (const [key, {count, value}] of Object.entries(stats)) {
      var transaction_type_id = transactionTypes[key]
      if (!transaction_type_id) {
        var insertTransactionTypeResult = insertTransactionType.run({name: key})
        transaction_type_id = insertTransactionTypeResult.lastInsertRowid
        transactionTypes[key] = transaction_type_id
      }

      if (count > 0 || value > 0) {
        insertTransactionStats.run({
          height: height,
          transaction_type_id: transaction_type_id,
          is_output: is_output,
          count: count,
          value: (value * 1e8).toFixed(0)
        })
      }
    }
  }

  function processInscriptionStats(stats, height) {
    for (const [key, {count, size}] of Object.entries(stats)) {
      var inscription_type_id = inscriptionTypes[key]
      if (!inscription_type_id) {
        var insertInscriptionTypeResult = insertInscriptionType.run({name: key})
        inscription_type_id = insertInscriptionTypeResult.lastInsertRowid
        inscriptionTypes[key] = inscription_type_id
      }

      if (size > 0 || value > 0) {
        insertInscriptionStats.run({
          height: height,
          inscription_type_id: inscription_type_id,
          count: count,
          size: size
        })
      }
    }
  }

  function processOrdinalStats(stats, height) {
    for (const [key, {count, size}] of Object.entries(stats)) {
      var ordinal_type_id = ordinalTypes[key]
      if (!ordinal_type_id) {
        var insertOrdinalTypeResult = insertOrdinalType.run({name: key})
        ordinal_type_id = insertOrdinalTypeResult.lastInsertRowid
        inscriptionTypes[key] = ordinal_type_id
      }

      if (size > 0 || value > 0) {
        insertOrdinalStats.run({
          height: height,
          ordinal_type_id: ordinal_type_id,
          count: count,
          size: size
        })
      }
    }
  }
  this.getTransactions = function(date) {
    var from = new Date(date)
    var until = new Date(date)
    until.setDate(from.getDate() + 1)

    // var heightRange = selectHeightRange.get({from: from.getTime() / 1000, until: until.getTime() / 1000})
    // if (heightRange.fromHeight == null) {
    //   return {}
    // }
    // var transactions = selectTransactions.all(heightRange)
    // return {
    //   from: heightRange.fromHeight,
    //   until: heightRange.untilHeight,
    //   count: {
    //     in: aggregateTransactions(transactions, 'in', 'count'),
    //     out: aggregateTransactions(transactions, 'out', 'count')
    //   } ,
    //   value: {
    //     in: aggregateTransactions(transactions, 'in', 'value'),
    //     out: aggregateTransactions(transactions, 'out', 'value')
    //   }
    // }
  }
}

function aggregateTransactions(transactions, type, category) {
  return transactions.filter(entry => entry.type == type).reduce((map, entry) => {
    var value = entry[category]
    if (value > 0) map[entry.desc] = value
    return map;
  }, {})
}
