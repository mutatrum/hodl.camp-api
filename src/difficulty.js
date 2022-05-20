const logger = require('./logger')

module.exports = function(bitcoin_rpc) {

  const difficulty = {
    current: 0,
    max: 0
  }
  
  this.init = async () => {
    const bestBlockHash = await bitcoin_rpc.getBestBlockHash()
    const bestBlockHeader = await bitcoin_rpc.getBlockHeader(bestBlockHash)
  
    for (var height = 0; height < bestBlockHeader.height; height += 2016) {
      const blockHash = await bitcoin_rpc.getBlockHash(height)
      const blockHeader = await bitcoin_rpc.getBlockHeader(blockHash)
      this.onBlockHeader(blockHeader)
    }

    this.onBlockHeader(bestBlockHeader)

    logger.log(`Difficulty: ${difficulty.current} max: ${difficulty.max}`)
  }

  this.onBlockHeader = async (blockHeader) => {
    // logger.log(`Block ${blockHeader.height} difficulty ${blockHeader.difficulty}`)
    difficulty.current = blockHeader.difficulty
    difficulty.max = Math.max(difficulty.max, blockHeader.difficulty)
  }

  this.getDifficulty = () => difficulty
}