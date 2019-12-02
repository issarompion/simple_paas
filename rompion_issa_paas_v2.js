"use strict"
const http = require('http');
const fs = require('fs');

const kafka = require('kafka-node')
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
    if(msg.action && msg.repository){
      let action = msg.action
      let url = msg.repository
      console.log('msg',action,url)

      switch(action) {
        case 'start':
          createJob(url)
          break;
        case 'stop':
          stopJob(url)
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


function createJob(url){
    var data = JSON.parse(fs.readFileSync('rompion_paas_task_deploy.json', 'utf8').toString());
    let id = url.split('/')[3]+url.split('/')[4]+'Issa'
    data.Job.ID = id
    data.Job.TaskGroups[0].Tasks[0].Config.args[0] = url;
    data.Job.TaskGroups[0].Tasks[0].Config.args[1] = "app";

    const options = {
      hostname: '148.60.11.202',
      port: 4646,
      path: '/v1/jobs',
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
        var result = JSON.parse(str);
        if(result){
          submit(url,'started')
          ready(id)
        }
    });
    })
    
    req.on('error', (error) => {
      console.error(error)
    })
    
    req.write(JSON.stringify(data))
    req.end()
}

function stopJob(url){
  let id = url.split('/')[3]+url.split('/')[4]+'Issa'
  const options = {
    hostname: '148.60.11.202',
    port: 4646,
    path: '/v1/job/'+id,
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
      if(result){
        submit(url,'stopped')
      }
  });
})
  
  req.on('error', (error) => {
    console.error(error)
  })
  
  req.write('')
  req.end()
}

function submit(url,state){
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
              state : state,
              repository : url
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

function ready(id){
  console.log('ready',id)
  const options = {
    hostname: '148.60.11.202',
    port: 4646,
    path: '/v1/job/'+id+'/allocations',
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
      var result = JSON.parse(str);
      if(result){
        //TODO send ready producer
        console.log(result)
      }
  });
  })
  
  req.on('error', (error) => {
    console.error(error)
  })
  
  req.write(JSON.stringify(data))
  req.end()
}