class wxRepotSdk {
    constructor(opt) {
        this.originPage = Page;
        this.originApp = App;
        this.wxRequest = wx.request;
        this.haveAjax = false;
        this.config = {
            isUse: true,
            isNet: true,
            isSys: true,
            isLocal: true,
            timeout: 500,
            domain: 'test.com'
        }
        this.config = Object.assign(this.config, opt || {});
        this.datas = {
            errs: [],
            markuser: '',
            net: '',
            system: {},
            loc: {},
            userInfo: {},
            pages: {},
            ajaxs: [],
        }
        this.init();
    }
    init() {
        if (!this.config.isUse) return;
        this.page();
        this.app();
        this.wrapRequest();
        if (this.config.isNet) this.network();
        if (this.config.isSys) this.system();
        if (this.config.isLocal) this.location();
    }
    randomString(len) {
        len = len || 19;
        var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz123456789';
        var maxPos = $chars.length;
        var pwd = '';
        for (let i = 0; i < len; i++) {
            pwd = pwd + $chars.charAt(Math.floor(Math.random() * maxPos));
        }
        return pwd + new Date().getTime();
    }
    page() {
        const _this = this;
        Page = (page) => {
            const _onShow = page.onShow || function () { };
            page.onShow = function () {
                _this.haveAjax = false;
                _this.datas.errs = [];
                _this.datas.ajaxs = [];
                let currentPages = getCurrentPages();
                if (currentPages && currentPages.length) {
                    const length = currentPages.length;
                    const lastpage = currentPages[length - 1];
                    _this.datas.pages.router = lastpage.__route__;
                    _this.datas.pages.options = lastpage.options || {};
                }
                if (!_this.datas.markuser) wx.getStorage({ key: 'ps_wx_mark_user', success(res) { _this.datas.markuser = res; } })
                setTimeout(() => {
                    if (!_this.haveAjax){
                        _this.datas.time = new Date().getTime();
                        _this.report();
                    }
                }, _this.config.timeout)
                return _onShow.apply(this, arguments)
            }
            _this.originPage(page)
        };
    }
    app() {
        const _this = this;
        App = (app) => {
            const _onError = app.onError || function () { };
            const _onShow = app.onShow || function () { };
            app.onError = function (err) {
                let errspit = err.split(/\n/) || [];
                let src, col, line;
                let errs = err.match(/\(.+?\)/)
                if (errs && errs.length) errs = errs[0]
                errs = errs.replace(/\w.+js/g, $1 => { src = $1; return ''; })
                errs = errs.split(':')
                if (errs && errs.length > 1) line = parseInt(errs[1] || 0); col = parseInt(errs[2] || 0)
                _this.datas.errs.push({
                    col: col,
                    line: line,
                    name: src,
                    msg: `${errspit[0]};${errspit[1]};${errspit[2]};`,
                    type: 'js'
                })
                return _onError.apply(this, arguments)
            }
            app.onShow = function () {
                const random = _this.randomString(19);
                wx.setStorage({ key: "ps_wx_mark_user", data: random })
                _this.datas.markuser = random;
                return _onShow.apply(this, arguments)
            }
            _this.originApp(app)
        }
    }
    network() {
        wx.getNetworkType({
            success: res => {
                this.datas.net = res.networkType;
            }
        })
    }
    system() {
        wx.getSystemInfo({
            success: res => {
                this.datas.system = res;
            }
        })
    }
    location() {
        wx.getLocation({
            type: 'wgs84',
            success: res => {
                this.datas.loc = res;
            }
        })
    }
    wrapRequest() {
        let timer = null;
        const originRequest = wx.request;
        const request = [];
        const response = [];
        const _this = this;
        Object.defineProperty(wx, 'request', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: function () {
                const config = arguments[0] || {};
                _this.haveAjax = true;
                request.push({
                    url: config.url || '',
                    options: config.data || '',
                    method: config.method || 'GET',
                    begintime: new Date().getTime()
                })
                const _complete = config.complete || function (data) { };
                config.complete = function (data) {
                    response.push({
                        errMsg: data.errMsg,
                        url: config.url || '',
                        statusCode: data.statusCode,
                        endtime: new Date().getTime(),
                        bodySize: data.header ? data.header['Content-Length'] : 0,
                    })
                    if (response.length === request.length){
                        clearTimeout(timer);
                        timer = setTimeout(()=>{
                            if (response.length === request.length) _this.mergeAjax(request, response);
                            clearTimeout(timer);
                        },_this.config.timeout)
                    }
                    return _complete.apply(this, arguments);
                }
                return originRequest.apply(this, arguments);
            }
        });
    }
    mergeAjax(request, response) {
        const _this = this;
        response.forEach((item, i) => {
            request.forEach((item1, i1) => {
                if (item.url.indexOf(item1.url) > -1) {
                    if (item.errMsg === 'request:ok' && item.statusCode === 200) {
                        _this.datas.ajaxs.push({
                            duration: item.endtime - item1.begintime || 0,
                            name: item1.url,
                            method: item1.method,
                            bodySize: item.bodySize,
                            options:item1.options
                        })
                    } else {
                        _this.datas.errs.push({
                            name: item1.url,
                            method: item1.method,
                            msg: item.errMsg,
                            type: 'ajax',
                            status: item.statusCode,
                            options:item1.options
                        })
                    }
                }
            })
            if (i === response.length - 1){
                _this.datas.time = new Date().getTime();
                _this.report();
            }
        });
    }
    report() {
        this.wxRequest({
            method: 'POST',
            url: this.config.domain,
            data: this.datas,
            success(res) {
                console.log(res)
            }
        })
    }
}
module.exports = wxRepotSdk;
