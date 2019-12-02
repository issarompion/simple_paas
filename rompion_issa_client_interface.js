'use strict';

const bodyParser = require('body-parser');
const express = require('express');
var app = express();
const kafka = require('kafka-node')

var list = {}

app.use(bodyParser.urlencoded({ extended: false }));
//app.use(express.static(path.join(__dirname)))
app.set('views', './views');
app.set('view engine', 'ejs');

app.get('/', function (req, res) {
    //res.sendFile(__dirname + '/index.html');
    res.render('index', { title: 'Simple App', list: list })
});

app.post('/submit-url', function (req, res) {
    let url = req.body.UrlGit
    let action = req.body.action
    submit(url,action)
    res.redirect('/')
});


function submit(url,action){
  console.log('submit')
  const Producer = kafka.Producer;
  const client = new kafka.KafkaClient({kafkaHost: '148.60.11.178:9092'});
  const producer = new Producer(client, { requireAcks: 1 })
  var topic = 'byzance'
  producer.on('ready', function () {
    console.log('ready')
      let payloads = [
          {
            topic: topic,
            messages: JSON.stringify({
              action : action,
              repository : url,
              domain : 'issa.esir.deuxfleurs.fr'
            })
          }
        ];
        producer.send(payloads, (err, data) => {
          if (err) {
            console.log('[kafka-producer -> '+topic+']: broker update failed');
          } else {
            console.log('[kafka-producer -> '+topic+']: broker update success');
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
const client = new kafka.KafkaClient({kafkaHost: '148.60.11.178:9092'});

const consumer = new Consumer(
    client,
    [
        { topic: 'byzance', partitions: 1 }
    ],
    {
        autoCommit: false
    }
);

consumer.on('message', function (message) {
  if(message.value){
    let msg = JSON.parse(message.value)
    console.log('parse',msg)
    if(msg.state && msg.repository){
      let state = msg.state
      let url = msg.repository
      console.log('msg',state,url)
      updateList(url,state)
    }
  }
});

consumer.on('error', function (err) {
    console.log('error', err);
  });

function updateList(url,state){
  if(url && state){
  list[url]=state
}
}