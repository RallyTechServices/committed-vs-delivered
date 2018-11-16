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
            'timeboxName',
            'timeboxStartDate',
            'timeboxEndDate',
            'timeboxAddedDate',
            'Planned',
            'Delivered'
        ],
        DEFAULT_FIELDS: [
            'FormattedID',
            'Name',
            'ScheduleState',
            'Iteration',
            'AcceptedDate',
        ],
        TIMEBOX_TYPE_ITERATION: 'Iteration',
        TIMEBOX_TYPE_RELEASE: 'Release',
        TIMEBOX_TYPE_ITERATION_LABEL: 'Iteration',
        TIMEBOX_TYPE_RELEASE_LABEL: 'Release',
        SNAPSHOT_LABEL: 'Snapshot'
    }
});
