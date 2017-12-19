require('./Base');

const inherits = require('util').inherits;
const miio = require('miio');

var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen;
MiRemoteMomentarySwitch = function(platform, config) {
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
        this.accessories['ProjectorAccessory'] = new MiRemoteMomentarySwitchService(this);
    }
    var accessoriesArr = this.obj2array(this.accessories);
    
    this.platform.log.debug("[MiIRRemote][DEBUG]Initializing " + this.config["type"] + " device: " + this.config["ip"] + ", accessories size: " + accessoriesArr.length);
    
    
    return accessoriesArr;
}
inherits(MiRemoteMomentarySwitch, Base);

MiRemoteMomentarySwitchService = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['Name'];
    this.token = dThis.config['token'];
    this.data = dThis.config['data'];
    this.platform = dThis.platform;
    this.onoffstate = false;
    this.SwitchStatus;
}

MiRemoteMomentarySwitchService.prototype.getServices = function() {
    var that = this;
    var services = [];
    var tokensan = this.token.substring(this.token.length-8);
    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "MiIRRemote-MomentarySwitch")
        .setCharacteristic(Characteristic.SerialNumber, tokensan);
    services.push(infoService);   
    var MiRemoteMomentarySwitchServices = this.SwitchStatus = new Service.Switch(this.name);
    var MiRemoteMomentarySwitchServicesCharacteristic = MiRemoteMomentarySwitchServices.getCharacteristic(Characteristic.On);
    MiRemoteMomentarySwitchServicesCharacteristic
        .on('set',function(value, callback) {
            try{
                if(value){
                    var codedata = this.data;
                    that.device.call("miIO.ir_play", {"freq":38400,"code":codedata}).then(result => {
                        that.platform.log.debug("[MiIRRemote][" + that.name + "]MomentarySwitch: Turned On");
                        setTimeout(function() {
                            that.SwitchStatus.getCharacteristic(Characteristic.On).updateValue(false);
                            that.onoffstate = false;
                            that.platform.log.debug("[MiIRRemote][" + that.name + "]MomentarySwitch: Auto Turned Off");
                        },0.3 * 1000)
                        callback(null);
                    }).catch(function(err) {
                        that.platform.log.error("[MiIRRemote][" + that.name + "][Custom][ERROR] Error: " + err);
                        callback(err);
                    });
                }else{
                    callback(null);
                }
            }catch(err) {
                that.platform.log.error("[MiIRRemote][" + this.name + "][ERROR]MomentarySwitch Error: " + err);
                callback(err);
            }
        }.bind(this))
        .on('get', function(callback) {
            callback(null,this.onoffstate);
        }.bind(this))
        
    services.push(MiRemoteMomentarySwitchServices);
    return services;
}