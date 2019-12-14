'use strict';

const variables = require('./variables')
const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const kafka = require('kafka-node')

let list = {}

app.use(bodyParser.urlencoded({ extended: false }));
app.set('views', './views');
app.set('view engine', 'ejs');

app.get('/', function (req, res) {
    res.render('index', { title: 'Simple App', list: list })
});

app.post('/submit-url', function (req, res) {
    let url = req.body.UrlGit
    let action = req.body.action
    submit(url,action)
    res.redirect('/')
});

function submit(url,action){
  console.log('submit',url,action)
  const Producer = kafka.Producer;
  const producer = new Producer(new kafka.KafkaClient({kafkaHost: variables.kafkaHost}), { requireAcks: 1 })
  producer.on('ready', function () {
      let payloads = [
          {
            topic: variables.topic,
            messages: JSON.stringify({
              action : action,
              repository : url
            })
          }
        ];
        producer.send(payloads, (err, data) => {
          if (err) {
            console.log('[kafka-producer -> '+variables.topic+']: broker update failed');
          } else {
            console.log('[kafka-producer -> '+variables.topic+']: broker update success');
          }
        });
  });

  producer.on('error', function (err) {
    console.log('error', err);
  })
}

app.listen(1995, function () {
    console.log('Le noeud est route...');
});


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
      if(msg.state && msg.repository){
        let state = msg.state
        let url = msg.repository
        updateList(url,state)
      }
    }
  });
  
  consumer.on('error', function (err) {
      console.log('error', err);
  });

})

function updateList(url,state){
  if(url && state){
  list[url]=state
}
}