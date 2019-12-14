const variables = require('./variables')
const http = require('http');
const kafka = require('kafka-node')
const Consumer = kafka.Consumer
const consumer = new Consumer(
  new kafka.KafkaClient({kafkaHost: variables.kafkaHost}),
    [
        { topic: variables.topic, partitions: 1 }
    ],
    {
        autoCommit: false
    }
);

variables.getOffset.then(lastoffset=>{

    consumer.on('message', function (message) {
      if(message.offset >= lastoffset && message.value){
        let msg = JSON.parse(message.value)
        if(msg.action == 'ready'){
          let target = msg.target
          let subdomain = msg.subdomain
          let identifier = msg.identifier
          connector(target,subdomain,identifier)
        }
        if(msg.action == 'unready'){
          let identifier = msg.identifier
          deconnector(identifier)
        }
      }
    });
  
    consumer.on('error', function (err) {
      console.log('error', err);
    });
  });

  function connector(target,subdomain,identifier){

    let data = {
      "@id": identifier,
      "match": [ { "host": [ subdomain ] } ],
      "handle": [{
              "handler": "subroute",
              "routes": [{
                      "handle": [{
                              "handler": "reverse_proxy",
                              "upstreams": [ { "dial": target } ]
                              }],
                      "match": [{ "path": [ "/"  ] }] 
  
                      }]
                  }]
  }
  
    const options = {
      hostname: '148.60.11.202',
      port: 2019,
      path: '/config/apps/http/servers/main/routes',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }
    
    const req = http.request(options, (res) => {
      console.log(`statusCode: ${res.statusCode}`)
      var str = '';
      res.setEncoding('utf8');
      res.on('data', (d) => {
        str += d
      })
      res.on('end', function() {
        console.log('config updated')
    });
    })
    
    req.on('error', (error) => {
      console.error(error)
    })
    
    req.write(JSON.stringify(data))
    req.end()
  }

  function deconnector(identifier){
    console.log('deconnector', identifier)
    const options = {
        hostname: '148.60.11.202',
        port: 2019,
        path: '/id/'+identifier,
        method: 'DELETE'
      }
      
      const req = http.request(options, (res) => {
        console.log(`statusCode: ${res.statusCode}`)
        var str = '';
        res.setEncoding('utf8');
        res.on('data', (d) => {
          str += d
        })
        res.on('end', function() {
          var result = str
      });
    })
      
      req.on('error', (error) => {
        console.error(error)
      })
      
      req.write('')
      req.end()
  }