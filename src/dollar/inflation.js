const logger = require('../logger')
const { formatDate } = require('../formatDate')

const https = require("https");
const cron = require("node-cron");

const URL = 'https://beta.bls.gov/dataViewer/csv'
const payload = 'selectedSeriesIds=CUSR0000SA0&startYear=1947&endYear=2022'

module.exports = function() {

  let result = {
    since: '',
    inflation: []
  }

  this.init = () => {
    retrieveInflation()
    cron.schedule("0 0 0 * * *", retrieveInflation)
  }

  this.getInflation = (since) => {
    if (since) {
      var date = new Date(since)
      date.setDate(1)
      const start = new Date(result.since)
      const diff = date.getMonth() - start.getMonth() + (12 * (date.getFullYear() - start.getFullYear()))
      return {
        since: formatDate(date),
        inflation: result.inflation.slice(diff)
      }
    }
    return result
  }

  function retrieveInflation() {
    const params = new URLSearchParams();
    params.append('selectedSeriesIds', 'CUSR0000SA0')
    params.append('startYear', '1947')
    params.append('endYear', new Date().getFullYear())
    const postData = params.toString()
  
    const options = {
      method: 'POST',headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length
      } 
    }
    const req = https.request(URL, options, res => {
      res.setEncoding('utf8');
      let body = '';
      res.on('data', chunk => body += chunk)
      res.on('end', () => process(body))
    })

    req.on('error', e => logger.log(`Error: ${e}`))
    req.on('timeout', () => {
      req.destroy()
      logger.log(`Request timeout`)
    })
    
    req.write(postData)
    req.end()
  }

  function process(body) {
    var since
    var inflation = []
    for (var line of body.split('\n').slice(1)) {
      if (line.indexOf(',') != -1) {
        var values = line.split(',');
        if (!since) {
          since = formatDate(new Date(values[3]))
        }
        inflation.push(Number(values[4]))
      }  
    }

    result = {
      since: since,
      inflation: inflation
    }
  }
}
