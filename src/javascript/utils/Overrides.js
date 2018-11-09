Ext.override(Rally.app.App, {
    /**
     * OVERRIDE: PreferenceManager.update returns records, not an updated settings
     * hash. This method in the SDK appears to simply apply the wrong data
     * to this.settings
     */

    /**
     * Update the settings for this app in preferences.
     * Provide a settings hash and this will update existing prefs or create new prefs.
     * @param options.settings the settings to create/update
     * @param options.success called when the prefs are loaded
     * @param options.scope scope to call success with
     */
    updateSettingsValues: function(options) {
        Rally.data.PreferenceManager.update(Ext.apply(this._getAppSettingsLoadOptions(), {
            requester: this,
            settings: options.settings,
            success: function(updatedSettings) {
                var updatedSettingsHash = _.reduce(updatedSettings, function(accumulator, updatedSetting) {
                    accumulator[updatedSetting.get('Name')] = updatedSetting.get('Value');
                    return accumulator;
                }, {});
                Ext.apply(this.settings, updatedSettingsHash);

                if (options.success) {
                    options.success.call(options.scope);
                }
            },
            scope: this
        }));
    }
})
