"use strict"

const variables = require('./variables')
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
var facture_number = 0
var registre = {}

consumer.on('message', function (message) {
  if(message.value){
    let msg = JSON.parse(message.value)
    if(msg.action && msg.repository){
        let action = msg.action
        let url = msg.repository
        console.log('msg',action,url)

        switch(action) {
            case 'start':
                    startCount(url)
              break;
            case 'stop':
                    stopCount(url)
              break;
            default:
              console.error('Unknown action')
          }
    }
    
  }
});

consumer.on('error', function (err) {
    console.log('error', err);
  });

 function startCount(url){
    registre[url] = {
        facture : 'FACTURE-'+ facture_number,
        debut : Date.now()
    }
    facture_number ++
  }

 function stopCount(url){
    let facture = registre[url].facture;
    let uptime = (Date.now()-registre[url].debut) / 1000;
    let price = (uptime / 60) + '€'

    var log4js = require('log4js');
  log4js.configure({
    appenders: {
    out:{ type: 'console' },
    app:{ type: 'file', filename: 'facturation.log' }
    },
    categories: {
    default: { appenders: [ 'out', 'app' ], level: 'debug' }
    }
    });
    var logger = log4js.getLogger();
    logger.info(facture+','+url+','+uptime+','+price);
  }