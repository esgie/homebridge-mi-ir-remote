require('./Base');

const inherits = require('util').inherits;
const miio = require('miio');

var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen;
MiRemoteSwitch = function(platform, config) {
    this.init(platform, config);
    
    Accessory = platform.Accessory;
    PlatformAccessory = platform.PlatformAccessory;
    Service = platform.Service;
    Characteristic = platform.Characteristic;
    UUIDGen = platform.UUIDGen;
    
    this.device = new miio.Device({
        address: this.config['ip'],
        token: this.config['token']
    });
    
    this.accessories = {};
    if(this.config['Name'] && this.config['Name'] != "") {
        this.accessories['SwitchAccessory'] = new MiRemoteSwitchService(this);
    }
    var accessoriesArr = this.obj2array(this.accessories);
    
    this.platform.log.debug("[MiIRRemote][DEBUG]Initializing " + this.config["type"] + " device: " + this.config["ip"] + ", accessories size: " + accessoriesArr.length);
    
    
    return accessoriesArr;
}
inherits(MiRemoteSwitch, Base);

MiRemoteSwitchService = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['Name'];
    this.token = dThis.config['token'];
    this.data = dThis.config['data'];
    this.platform = dThis.platform;
    this.onoffstate = false;
}

MiRemoteSwitchService.prototype.getServices = function() {
    var that = this;
    var services = [];
    var tokensan = this.token.substring(this.token.length-8);
    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "MiIRRemote-Switch")
        .setCharacteristic(Characteristic.SerialNumber, tokensan);
    services.push(infoService);   
    var MiRemoteSwitchServices = new Service.Switch(this.name);
    var MiRemoteSwitchServicesCharacteristic = MiRemoteSwitchServices.getCharacteristic(Characteristic.On);
    MiRemoteSwitchServicesCharacteristic
        .on('set',function(value, callback) {
            var onoff = value ? "on" : "off";
            this.onoffstate = value;
            this.device.call("miIO.ir_play", {"freq":38400,"code":this.data[onoff]}).then(result => {
                that.platform.log.debug("[MiIRRemote][" + this.name + "]Switch: " + onoff);
                callback(null);
            }).catch(function(err) {
                that.platform.log.error("[MiIRRemote][" + this.name + "][ERROR]Switch Error: " + err);
                callback(err);
            });
        }.bind(this))
        .on('get', function(callback) {
            callback(null,this.onoffstate);
        }.bind(this))
        
    services.push(MiRemoteSwitchServices);
    return services;
}