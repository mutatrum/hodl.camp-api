const logger = require('../logger')

const INSCRIPTION_PATTERN = /^20[a-f0-9]{64}ac0063036f72640101[a-f0-9]*68$/
const BRC20_PATTERN = /^20117f692257b2331233b5705ce9c682be8719ff1b2b64cbca290bd6faeb54423eac.{12}01750063036f7264010118746578742f706c61696e3b636861727365743d7574662d3800.{2,4}(7b.*7d)68$/

const TYPES = ['coinbase', 'fee', 'pubkey', 'pubkeyhash', 'scripthash', 'multisig', 'witness_v0_keyhash', 'witness_v0_scripthash', 
               'witness_v1_taproot', 'witness_unknown', 'nulldata', 'nonstandard']

module.exports = function(block) {

  var ins = {}
  var outs = {'coinbase': {count: 0, value: 0}, 'fee': {count:0, value: 0}, 'fee cpfp': {count:0, value: 0}}
  let kinds = {}
  let inscriptions = {}
  let brc20s = {}

  var fee = 0
  var cpfp = 0;

  var txids = new Map()

  for (var tx of block.tx.splice(1)) {

    txids.set(tx.txid, tx.fee / tx.vsize)

    for (var vout of tx.vout) {
      var type = vout.scriptPubKey.type

      if (TYPES.indexOf(type) === -1) TYPES.push(type)

      if (typeof outs[type] === 'undefined') {
        outs[type] = {count : 0, value : 0}
      }
      outs[type].count += 1
      outs[type].value += vout.value
    }

    let inscriptionCount = 0
    let brc20Count = 0;
    let content_type = null
    let kind = null

    let isCPFP = false

    for (var vin of tx.vin) {
      var prevout = vin.prevout
      var type = prevout.scriptPubKey.type

      if (prevout.scriptPubKey.type === 'witness_v1_taproot') {
        if (vin.txinwitness !== undefined) {
          for (var txinwitness of vin.txinwitness) {
            if(txinwitness.match(INSCRIPTION_PATTERN)) {
              inscriptionCount++
              let length = parseInt(txinwitness.substring(84, 86), 16)
              content_type = Buffer.from(txinwitness.substring(86, 86 + (length * 2)), "hex").toString("utf-8").split(';')[0].split('+')[0].split('/')[1]
              continue;
            }
            var brc20_match = txinwitness.match(BRC20_PATTERN)
            if(brc20_match) {
              brc20Count++;
              try {
                var json = JSON.parse(Buffer.from(brc20_match[1], "hex").toString("utf-8"))
                // console.log(`${block.height} ${tx.txid} ${JSON.stringify(json)}`)
                if (json.p === 'brc-20') {
                  content_type = json.op.substring(0, 4) + ' ' + json.tick.toLowerCase()
                } else {
                  content_type = json.p + ' ' + json.op
                }
              }
              catch (syntaxError) {
                content_type = 'brc-20 invalid'
              }
              continue;
            }
            var text = Buffer.from(txinwitness, "hex").toString("utf-8")
            if (text.indexOf('ord') != -1 && text.indexOf('text/plain') != -1) {
              content_type = 'brc-20 text'
            }
          }
          // https://bitcoin.stackexchange.com/questions/118604/how-can-i-tell-if-a-taproot-input-is-a-key-path-spend-or-a-script-path-spend/
          let witness_count = vin.txinwitness.length
          let has_annex = vin.txinwitness[vin.txinwitness.length - 1].startsWith('50')
          if (has_annex) witness_count--;
          type += witness_count == 1 ? ' scriptpath' : ' keypath'
          if (has_annex) type += ' annex'
        } else {
          type += ' no witness'
        }
      }

      if (TYPES.indexOf(type) === -1) TYPES.push(type)

      if (typeof ins[type] === 'undefined') {
        ins[type] = {count : 0, value : 0}
      }

      ins[type].count += 1
      if (txids.has(vin.txid)) {
        // Transaction is spent in same block
        outs[prevout.scriptPubKey.type].value -= prevout.value
        let feeRate = tx.fee / tx.vsize
        if (txids.get(vin.txid) < feeRate) {
          isCPFP = true
        }
      } else {
        ins[type].value += prevout.value
      }
    }

    let fakeMultiSig = 0
    for (var vout of tx.vout) {
      if (vout.scriptPubKey.hex.match('^51(210[23][0-9a-f]{64})+53ae$')) {
        fakeMultiSig++
      }
    }
    if (fakeMultiSig > 0) {
      inscriptionCount++
      content_type = 'cntrprty'
    }

    if (inscriptionCount > 0) {
      let total = inscriptions[content_type]
      if (!total) {
        total = {count: 0, size: 0}
        inscriptions[content_type] = total
      }
      total.count++
      total.size += tx.weight

      kind = 'Inscription'
    }

    if (brc20Count > 0) {
      let total = brc20s[content_type]
      if (!total) {
        total = {count: 0, size: 0}
        brc20s[content_type] = total
      }
      total.count++
      total.size += tx.weight

      kind = 'BRC-20'
    }
    // if (tx.vin.length === 1 && tx.vout.length === 1) {
    //   let inaddr = tx.vin[0].prevout.scriptPubKey.address
    //   let outaddr = tx.vout[0].scriptPubKey.address
    //   oneins.add(inaddr)
    //   oneouts.add(outaddr)
    //   oneone.push([inaddr, outaddr])
    // }

    if (!kind) {
      kind = getKind(tx.vin.length, tx.vout.length)

      // if (tx.txid == '12afa4bfab373ac148e4ad9145d39329105fb56a7027cd7253d2b7c7027c5b86') console.log(tx)
      // if (isCPFP) kind += ' CPFP' //console.log(tx.txid) // kind != '1 → 1' && 
    }

    let totalKind = kinds[kind]
    if (!totalKind) {
      totalKind = {count: 0, size: 0}
      kinds[kind] = totalKind
    }
    totalKind.count++
    totalKind.size += tx.weight

    if (isCPFP) {
      cpfp += tx.fee
    } else {     
      fee += tx.fee
    }
  }

  outs['coinbase'].value += block.tx[0].vout[0].value - (fee - cpfp)
  outs['fee'].value += fee
  outs['fee cpfp'].value += cpfp

  return {
    ins: ins,
    outs: outs,
    kinds: kinds,
    inscriptions: inscriptions,
    brc20s: brc20s
  }
}

function getKind(i, o) {
  if (i > 1 && o === 1) return `Consolidation`
  if (i >= 10 && o === 2) return `Consolidation`
  if (i <= 2 && o <= 2) return `${i} → ${o}`
  if (i === 5 && o === 5) return `${i} → ${o}`
  if (i === 1 && o >= 10) return `Batch`
  if (i < 10 && o >= 100) return `Batch`
  return `${aggr(i)} → ${aggr(o)}`
}

function aggr(len) {
  if (len >= 100) return '100s'
  if (len >= 10) return '10s'
  if (len >= 3) return 'Few'
  return len
}
