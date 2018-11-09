Ext.define('Constants', {
    statics: {
        CHART_TITLE: 'Stories Committed vs. Delivered',
        PLANNED: 'Planned',
        UNPLANNED: 'Unplanned',
        COMMITTED: 'Comitted',
        DELIVERED: 'Delivered',
        IN_PROGRESS: ' (In-Progress)',
        Y_AXIS_TITLE: 'Count',
        APP_RESERVED_HEIGHT: 60,
        DERIVED_FIELDS: [
            'IterationStartDate',
            'IterationEndDate',
            'IterationAddedDate',
            'Planned',
            'Delivered'
        ],
        DEFAULT_FIELDS: [
            'FormattedID',
            'Name',
            'ScheduleState',
            'Iteration',
            'AcceptedDate',
        ]
    }
});
