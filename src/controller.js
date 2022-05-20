const logger = require('./logger')

const Difficulty = require('./difficulty')
let difficulty

const Halvings = require('./halvings')
let halvings

module.exports = function(bitcoin_rpc) {

  this.init = async () => {
    const networkInfo = await bitcoin_rpc.getNetworkInfo()
    logger.log(`connected to Bitcoin Core ${networkInfo.subversion} on ${bitcoin_rpc.getURI()}`)

    difficulty = new Difficulty(bitcoin_rpc)
    await difficulty.init()

    halvings = new Halvings(bitcoin_rpc)
    await halvings.init()
  }


  this.onBlockHeader = async (blockHeader) => {
    await difficulty.onBlockHeader(blockHeader)
    await halvings.onBlockHeader(blockHeader)
  }

  this.getDifficulty = () => difficulty.getDifficulty()

  this.getHalvings = () => halvings.getHalvings()
}
