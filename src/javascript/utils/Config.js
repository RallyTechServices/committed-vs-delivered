(function() {
    var Ext = window.Ext4 || window.Ext;

    Ext.define('TsConfig', {
        alias: 'plugin.tsconfig',
        extend: 'Ext.AbstractPlugin',
        mixins: {
            observable: 'Ext.util.Observable'
        },

        /**
         * @cfg {Object}
         * Additional configuration to pass to the button
         */
        buttonConfig: {},

        constructor: function(config) {
            this.callParent(config);
            this.mixins.observable.constructor.call(this, config);
            this.addEvents('close');
        },

        init: function(cmp) {
            this.cmp = cmp;
            this._addButton();
        },

        configItems: [],

        _addButton: function() {
            this.cmp.getHeader().getRight().add(
                Ext.merge(this.buttonConfig, {
                    xtype: 'rallybutton',
                    id: 'config-button',
                    style: { 'float': 'right' },
                    cls: 'secondary rly-small',
                    frame: false,
                    itemId: 'tsconfig-menu-button',
                    listeners: {
                        click: this._onClick,
                        scope: this
                    }
                })
            );
        },

        _onClick: function(button) {
            var menu = Ext.widget({
                xtype: 'rallypopover',
                floating: true,
                target: 'config-button',
                showChevron: false,
                items: [{
                    xtype: 'container',
                    cls: 'settings-popover',
                    padding: '10',
                    items: this.configItems
                }],
                title: this.title,
                listeners: {
                    scope: this,
                    // Must use destroy to catch all cases of dismissing the popover
                    destroy: function() {
                        this.fireEvent('close', this);
                    }
                }
            });
            menu.showBy(button.getEl());
            if (button.toolTip) {
                button.toolTip.hide();
            }
        }
    });
})();
