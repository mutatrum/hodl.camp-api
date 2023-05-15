const logger = require('./logger')
const BitcoinRpc = require('./bitcoin-rpc')
const zmq = require('zeromq')
const Controller = require('./controller')
const App = require('./app')

module.exports = function(config) {
  const bitcoin_rpc = new BitcoinRpc(config.bitcoind)

  this.run = async () => {
    logger.log('hodl.camp-api')

    const controller = new Controller(config, bitcoin_rpc)
    await controller.init()

    const app = new App(config.port, controller)

    const sock = zmq.socket('sub')
    sock.connect(`tcp://${config.bitcoind.host}:${config.bitcoind.zmqport}`)  
    sock.subscribe('hashblock')
    sock.on('message', async (topic, message) => {
      if (topic.toString() === 'hashblock') {
        const blockHash = message.toString('hex')
        const blockHeader = await bitcoin_rpc.getBlockHeader(blockHash)
        controller.onBlockHeader(blockHeader)
      }
    })
  }
}
