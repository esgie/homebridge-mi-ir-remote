var Service, Characteristic;

MiRemoteFan = function (platform, config) {
    this.platform = platform;
    this.config = config;

    this.platform.log.debug('[MiRemoteFan]Initializing MiRemoteFan: ' + this.config['ip']);

    return new MiRemoteFanService(this);
};

MiRemoteFanService = function (dThis) {
    this.name = dThis.config['Name'];
    this.token = dThis.config['token'];
    this.data = dThis.config['data']; // on, off, speeds[], swing: {on, off}

    var deviceConfig = {
        address: dThis.config['ip'],
        token: dThis.config['token'],
    };
    this.readydevice = false;
    this.device = dThis.platform.getMiioDevice(deviceConfig, this);

    Service = dThis.platform.HomebridgeAPI.hap.Service;
    Characteristic = dThis.platform.HomebridgeAPI.hap.Characteristic;

    this.platform = dThis.platform;
    this.preservePowerState = this.data['keepstate'];
    this.powerState = false;
    this.swingState = false;

    this.enableSwing = this.data['swing'] && this.data['swing']['on'] != null && this.data['swing']['off'] != null;
    this.enableSpeed = this.data['speeds'] && Array.isArray(this.data['speeds']) && this.data['speeds'].length;

    if (this.enableSpeed) {
        this.speed = null;
        this.shouldSyncSpeed = true;
        this.speedsMap = [];

        var oneDegree = Math.floor(100 / this.data['speeds'].length);
        var position = -1;
        var maxIndex = oneDegree * this.data['speeds'].length;
        for (var i = 0; i <= maxIndex; i += oneDegree) {
            position++;

            for (var j = i; j < i + oneDegree; j++) {
                this.speedsMap[j] = this.data['speeds'][position];
            }
        }
        if (maxIndex < 100) {
            for (var i = maxIndex; i <= 100; i++) {
                this.speedsMap[i] = this.data['speeds'][position];
            }
        }

        this.speed = 1;
    }
};

MiRemoteFanService.prototype.getServices = function () {
    var that = this;
    var services = [];
    var tokensan = this.token.substring(this.token.length - 8);
    var serviceInfo = new Service.AccessoryInformation();

    serviceInfo
        .setCharacteristic(Characteristic.Manufacturer, 'XiaoMi')
        .setCharacteristic(Characteristic.Model, 'MiIRRemote-Fan')
        .setCharacteristic(Characteristic.SerialNumber, tokensan);

    services.push(serviceInfo);

    var fanService = new Service.Fan(this.name);

    fanService
        .getCharacteristic(Characteristic.On)
        .on('get', function (callback) {
            callback(null, this.powerState);
        }.bind(this))
        .on('set', function (state, callback) {
            if (!this.readydevice) {
                callback(new Error('[' + this.name + '][ERROR]Custom - Unready'));
                return;
            }

            if (this.powerState == state && this.preservePowerState) {
                callback(null);
                return;
            }

            var onOff = state ? 'on' : 'off';
            this.powerState = state;

            this.device
                .call('miIO.ir_play', {'freq': 38400, 'code': that.data[onOff]})
                .then(() => {
                    that.platform.log.debug('[MiIRRemote][' + that.name + ']Fan: ' + onOff);

                    // Call default speed when powering on the first time in order to sync speed
                    if (that.powerState && that.enableSpeed && that.shouldSyncSpeed) {
                        setTimeout(function () {
                            that.device
                                .call('miIO.ir_play', {'freq': 38400, 'code': that.speedsMap[1]})
                                .then(() => {
                                    that.platform.log.debug('[MiIRRemote][' + that.name + ']Fan Speed: 1');

                                    that.speed = 1;
                                    that.shouldSyncSpeed = false;
                                });

                            callback(null);
                        }, 300);
                    } else {
                        callback(null);
                    }
                })
                .catch(function (err) {
                    that.platform.log.error('[MiIRRemote][' + that.name + '][ERROR]Fan Error: ' + err);
                    callback(err);
                });
        }.bind(that));

    this.enableSpeed && fanService
        .getCharacteristic(Characteristic.RotationSpeed)
        .on('get', function (callback) {
            callback(null, that.speed);
        }.bind(that))
        .on('set', function (speed, callback) {
            if (!that.readydevice) {
                callback(new Error('[' + that.name + '][ERROR]Custom - Unready'));
                return;
            }

            this.speed = speed;

            that.device
                .call('miIO.ir_play', {'freq': 38400, 'code': that.speedsMap[speed]})
                .then(() => {
                    that.platform.log.debug('[MiIRRemote][' + that.name + ']Fan Speed: ' + speed);
                    callback(null);
                })
                .catch(function (err) {
                    that.platform.log.error('[MiIRRemote][' + that.name + '][ERROR]Fan Error: ' + err);
                    callback(err);
                });
        }.bind(this));

    this.enableSwing && fanService.getCharacteristic(Characteristic.SwingMode)
        .on('get', function (callback) {
            callback(null, this.swingState);
        }.bind(this))
        .on('set', function (state, callback) {
            if (!this.readydevice) {
                callback(new Error('[' + that.name + '][ERROR]Custom - Unready'));
                return;
            }

            var onOff = state ? 'on' : 'off';
            this.swingState = state;

            this.device
                .call('miIO.ir_play', {'freq': 38400, 'code': that.data[onOff]})
                .then(() => {
                    that.platform.log.debug('[MiIRRemote][' + that.name + ']Fan Swing: ' + onOff);
                    callback(null);
                })
                .catch(function (err) {
                    that.platform.log.error('[MiIRRemote][' + that.name + '][ERROR]Fan Error: ' + err);
                    callback(err);
                });
        }.bind(this));

    services.push(fanService);
    return services;
};
