require('./Base');

const inherits = require('util').inherits;
const miio = require('miio');

var Accessory, PlatformAccessory, Service, Characteristic, UUIDGen;
MiRemoteCustom = function(platform, config) {
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
        this.accessories['ProjectorAccessory'] = new MiRemoteCustomService(this);
    }
    var accessoriesArr = this.obj2array(this.accessories);
    
    this.platform.log.debug("[MiIRRemote][DEBUG]Initializing " + this.config["type"] + " device: " + this.config["ip"] + ", accessories size: " + accessoriesArr.length);
    
    
    return accessoriesArr;
}
inherits(MiRemoteCustom, Base);

MiRemoteCustomService = function(dThis) {
    this.device = dThis.device;
    this.name = dThis.config['Name'];
    this.token = dThis.config['token'];
    this.data = dThis.config['data'];
    this.interval = dThis.config['interval'];
    if(!this.interval){
        this.interval = 1;
    }
    this.platform = dThis.platform;
    this.onoffstate = false;
}

MiRemoteCustomService.prototype.getServices = function() {
    var that = this;
    var services = [];
    var tokensan = this.token.substring(this.token.length-8);
    var infoService = new Service.AccessoryInformation();
    infoService
        .setCharacteristic(Characteristic.Manufacturer, "XiaoMi")
        .setCharacteristic(Characteristic.Model, "MiIRRemote-Custom")
        .setCharacteristic(Characteristic.SerialNumber, tokensan);
    services.push(infoService);   
    var MiRemoteCustomServices = new Service.Switch(this.name);
    var MiRemoteCustomServicesCharacteristic = MiRemoteCustomServices.getCharacteristic(Characteristic.On);
    MiRemoteCustomServicesCharacteristic
        .on('set',function(value, callback) {
            try{
                var onoff = value ? "on" : "off";
                this.onoffstate = value;
                var onoffdata = this.data[onoff];
                for (var i in onoffdata) {
                    var dataa = onoffdata[i];
                    var arra = dataa.split('|');
                    var duetime = arra[0];
                    var code = arra[1];
                    setTimeout(function(code,onoff,i,duetime) {
                        that.device.call("miIO.ir_play", {"freq":38400,"code":code}).then(result => {
                            that.platform.log.debug("[MiIRRemote][" + that.name + "]Custom: Send " + onoff + " - " + i + " interval:" + duetime);
                        }).catch(function(err) {
                            if(err == "Error: Call to device timed out"){
                                that.platform.log.debug("[MiIRRemote][" + this.name + "][ERROR]Custom - Remote Offline");
                            }else{
                                that.platform.log.error("[MiIRRemote][" + this.name + "][ERROR]Custom Error: " + err);
                            }
                        });
                    },duetime * 1000,code,onoff,i,duetime)    
                }
                callback(null);
            }catch(err) {
                that.platform.log.error("[MiIRRemote][General][ERROR]Custom Error: " + err);
                callback(err);
            }
        }.bind(this))
        .on('get', function(callback) {
            callback(null,this.onoffstate);
        }.bind(this))
        
    services.push(MiRemoteCustomServices);
    return services;
}