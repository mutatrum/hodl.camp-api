const logger = require('../logger')

module.exports = function(bitcoin_rpc) {

  const difficulty = {
    current: 0,
    max: 0
  }

  this.init = async () => {
    const bestBlockHash = await bitcoin_rpc.getBestBlockHash()
    const bestBlockHeader = await bitcoin_rpc.getBlockHeader(bestBlockHash)

    for (var height = 0; height <= bestBlockHeader.height; height += 2016) {
      const blockHash = await bitcoin_rpc.getBlockHash(height)
      const blockHeader = await bitcoin_rpc.getBlockHeader(blockHash)
      newDifficulty(blockHeader.difficulty)
    }

    logger.log(`Difficulty ${difficulty.current} max ${difficulty.max}`)
  }

  this.onBlockHeader = async (blockHeader) => {
    if (difficulty.current != blockHeader.difficulty) {
      logger.log(`Difficulty ${blockHeader.difficulty} height ${blockHeader.height}`)
    }
    newDifficulty(blockHeader.difficulty)
  }

  function newDifficulty(newDifficulty) {
    difficulty.current = newDifficulty
    difficulty.max = Math.max(difficulty.max, newDifficulty)
  }

  this.getDifficulty = () => difficulty
}
