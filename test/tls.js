/*
 * Copyright 2013-2018 The NATS Authors
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* jslint node: true */
/* global describe: false, before: false, after: false, it: false */
'use strict';

var NATS = require('../'),
    nsc = require('./support/nats_server_control'),
    should = require('should'),
    fs = require('fs');

describe('TLS', function() {

    var PORT = 1442;
    var TLSPORT = 1443;
    var TLSVERIFYPORT = 1444;
    var flags = [];

    var server;
    var tlsServer;
    var tlsVerifyServer;

    // Start up our own nats-server for each test
    // We will start a plain, a no client cert, and a client cert required.
    before(function(done) {
        server = nsc.start_server(PORT, function() {
            var flags = ['--tls', '--tlscert', './test/certs/server-cert.pem',
                '--tlskey', './test/certs/server-key.pem'
            ];
            tlsServer = nsc.start_server(TLSPORT, flags, function() {
                var flags = ['--tlsverify', '--tlscert', './test/certs/server-cert.pem',
                    '--tlskey', './test/certs/server-key.pem',
                    '--tlscacert', './test/certs/ca.pem'
                ];
                tlsVerifyServer = nsc.start_server(TLSVERIFYPORT, flags, done);
            });
        });
    });


    // Shutdown our server after each test.
    after(function(done) {
        nsc.stop_cluster([server, tlsServer, tlsVerifyServer], done);
    });

    it('should error if server does not support TLS', function(done) {
        var nc = NATS.connect({
            port: PORT,
            tls: true
        });
        nc.on('error', function(err) {
            should.exist(err);
            should.exist((/Server does not support a secure/).exec(err));
            nc.close();
            done();
        });
    });

    it('should reject without proper CA', function(done) {
        var nc = NATS.connect({
            port: TLSPORT,
            tls: true
        });
        nc.on('error', function(err) {
            should.exist(err);
            should.exist((/unable to verify the first certificate/).exec(err));
            nc.close();
            done();
        });
    });

    it('should connect if authorized is overridden', function(done) {
        var tlsOptions = {
            rejectUnauthorized: false,
        };
        var nc = NATS.connect({
            port: TLSPORT,
            tls: tlsOptions
        });
        should.exist(nc);
        nc.on('connect', function(client) {
            client.should.equal(nc);
            nc.stream.authorized.should.equal(false);
            nc.close();
            done();
        });
    });

    it('should connect with proper ca and be authorized', function(done) {
        var tlsOptions = {
            ca: [fs.readFileSync('./test/certs/ca.pem')]
        };
        var nc = NATS.connect({
            port: TLSPORT,
            tls: tlsOptions
        });
        should.exist(nc);
        nc.on('connect', function(client) {
            client.should.equal(nc);
            nc.stream.authorized.should.equal(true);
            nc.close();
            done();
        });
    });

    it('should reject without proper cert if required by server', function(done) {
        var nc = NATS.connect({
            port: TLSVERIFYPORT,
            tls: true
        });
        nc.on('error', function(err) {
            should.exist(err);
            should.exist((/Server requires a client certificate/).exec(err));
            nc.close();
            done();
        });
    });


    it('should be authorized with proper cert', function(done) {
        var tlsOptions = {
            key: fs.readFileSync('./test/certs/client-key.pem'),
            cert: fs.readFileSync('./test/certs/client-cert.pem'),
            ca: [fs.readFileSync('./test/certs/ca.pem')]
        };
        var nc = NATS.connect({
            port: TLSPORT,
            tls: tlsOptions
        });
        nc.on('connect', function(client) {
            client.should.equal(nc);
            nc.stream.authorized.should.equal(true);
            nc.close();
            done();
        });
    });

});
