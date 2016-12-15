'use strict';

/**
 * Requirements
 * @ignore
 */
const BaseTask = require('./BaseTask.js').BaseTask;
const gulp = require('gulp');
const Stream = require('stream');
const VinylFile = require('vinyl');


/**
 * @memberOf task
 */
class ReadFilesTask extends BaseTask
{
    /**
     * @inheritDocs
     */
    static get className()
    {
        return 'task/ReadFilesTask';
    }


    /**
     * @returns {Stream}
     */
    stream(stream, buildConfiguration, parameters)
    {
        if (!parameters || (!parameters.path && !parameters.readPath))
        {
            return super.stream(stream, buildConfiguration, parameters);
        }

        const path = parameters.path || parameters.readPath;
        const section = this._cliLogger.section('Reading files from <' + path + '>');

        // Render stream
        const resultStream = new Stream.Transform({ objectMode: true });
        resultStream._transform = (file, encoding, callback) =>
        {
            const resultFile = new VinylFile(
            {
                path: parameters.readPathBase ? file.path.replace(parameters.readPathBase + '/', '') : file.path,
                contents: file.contents
            });
            const work = this._cliLogger.work('Reading file <' + resultFile.path + '>');
            resultStream.push(resultFile);
            this._cliLogger.end(work);
            callback();
        };

        // Wait for stream
        resultStream.on('finish', () =>
        {
            this._cliLogger.end(section);
        });

        return gulp.src(path).pipe(resultStream);
    }
}


/**
 * Exports
 * @ignore
 */
module.exports.ReadFilesTask = ReadFilesTask;
