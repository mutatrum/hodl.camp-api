const logger = require('../logger')

module.exports = function(bitcoin_rpc) {

  const QUARTER = 210000 / 4

  const halvings = []
  let nextHalving;
  
  this.init = async () => {
    const bestBlockHash = await bitcoin_rpc.getBestBlockHash()
    const bestBlockHeader = await bitcoin_rpc.getBlockHeader(bestBlockHash)
  
    for (var height = 0; height < bestBlockHeader.height; height += QUARTER) {
      const blockHash = await bitcoin_rpc.getBlockHash(height)
      const blockHeader = await bitcoin_rpc.getBlockHeader(blockHash)
      halvings.push(formatDate(new Date(blockHeader.mediantime * 1000)))
    }

    nextHalving = await getNextHalvingDate(bestBlockHeader)

    logger.log(`Halvings: ${halvings}`)
    logger.log(`Next halving: ${nextHalving}`)
  }

  this.onBlockHeader = async (blockHeader) => {
    if (blockHeader.height % 52500 == 0) {
      halvings.push(formatDate(new Date(blockHeader.mediantime * 1000)))
    }

    var next = await getNextHalvingDate(blockHeader)

    if (nextHalving != next) {
      logger.log(`Next halving: ${nextHalving}`)
    }
    nextHalving = next;
  }

  this.getHalvings = () => [...halvings, nextHalving]

  async function getNextHalvingDate(blockHeader) {
    var blockHeight = blockHeader.height;
    var halvingBlockHeight = Math.ceil(blockHeight / QUARTER ) * QUARTER
    var blockHeightDelta = halvingBlockHeight - blockHeight
    var previousBlockHeight = blockHeight - blockHeightDelta
    var previousBlockHash = await bitcoin_rpc.getBlockHash(previousBlockHeight)
    var previousBlockHeader = await bitcoin_rpc.getBlockHeader(previousBlockHash)
    var timeDelta = blockHeader.mediantime - previousBlockHeader.mediantime;
    return formatDate(new Date((blockHeader.mediantime + timeDelta) * 1000))
  }

  function formatDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }

  function pad(string) {
    return string.toString().padStart(2, '0');
  }
}
