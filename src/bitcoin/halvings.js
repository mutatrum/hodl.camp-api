const logger = require('../logger')
const { formatDate } = require('../formatDate')

module.exports = function(bitcoin_rpc) {

  const HALVING = 210000
  const QUARTER = HALVING / 4

  const halvings = []
  let nextHalving

  const halving_candles = []
  let nextHalvingCandle
  
  this.init = async () => {
    const bestBlockHash = await bitcoin_rpc.getBestBlockHash()
    const bestBlockHeader = await bitcoin_rpc.getBlockHeader(bestBlockHash)
  
    for (var height = 0; height < bestBlockHeader.height; height += QUARTER) {
      const blockHash = await bitcoin_rpc.getBlockHash(height)
      const blockHeader = await bitcoin_rpc.getBlockHeader(blockHash)

      const date = formatDate(new Date(blockHeader.mediantime * 1000));

      if (height % HALVING == 0) halvings.push(date)

      halving_candles.push(date)
    }

    nextHalving = await getNextHalvingDate(bestBlockHeader, HALVING)
    nextHalvingCandle = await getNextHalvingDate(bestBlockHeader, QUARTER)

    logger.log(`Halvings: ${halvings}`)
    logger.log(`Next halving: ${nextHalving}`)
  }

  this.onBlockHeader = async (blockHeader) => {
    if (blockHeader.height % HALVING == 0) {
      halvings.push(formatDate(new Date(blockHeader.mediantime * 1000)))
      if (blockHeader.height % QUARTER == 0) {
        halving_candles.push(formatDate(new Date(blockHeader.mediantime * 1000)))
      }
    }

    var next = await getNextHalvingDate(blockHeader, HALVING)
    if (nextHalving != next) {
      logger.log(`Next halving: ${nextHalving}`)
    }
    nextHalving = next;

    var next = await getNextHalvingDate(blockHeader, QUARTER)
    if (nextHalvingCandle != next) {
      logger.log(`Next halving quarter: ${nextHalvingCandle}`)
    }
    nextHalvingCandle = next;
  }

  this.getHalvings = () => [...halvings, nextHalving]

  this.getHalvingCandles = () => [...halving_candles, nextHalvingCandle]

  async function getNextHalvingDate(blockHeader, step) {
    var blockHeight = blockHeader.height;
    var halvingBlockHeight = Math.ceil(blockHeight / step ) * step
    var blockHeightDelta = halvingBlockHeight - blockHeight
    var previousBlockHeight = blockHeight - blockHeightDelta
    var previousBlockHash = await bitcoin_rpc.getBlockHash(previousBlockHeight)
    var previousBlockHeader = await bitcoin_rpc.getBlockHeader(previousBlockHash)
    var timeDelta = blockHeader.mediantime - previousBlockHeader.mediantime;
    return formatDate(new Date((blockHeader.mediantime + timeDelta) * 1000))
  }
}
