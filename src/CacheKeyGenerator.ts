import {Schema} from "mongoose";
import objectHash from "object-hash";
import _ from "lodash";
import ObjectId = Schema.Types.ObjectId;


export class CacheKeyGenerator {
    private readonly function_name: string;
    private readonly should_sort_args: boolean;

    constructor(function_name: string, should_sort_args: boolean) {
        this.function_name = function_name;
        this.should_sort_args = should_sort_args;
    }

    for(...args: any[]) {

        let flattened_String = this.flattenObject([...args]);

        if (this.should_sort_args) flattened_String = flattened_String.sort();

        const args_cache_key = objectHash([...flattened_String], {
            ignoreUnknown: true,
            algorithm: 'md5'
        });
        return `{${this.function_name}}:${args_cache_key}`; //should be safe for all providers currently available needs to be overridden for special cases.
    }

    private flattenObject(o: any): any {

        if (o === undefined) return "__undefined__";
        if (o === null) return "__null__";

        if (o instanceof ObjectId) return String(o);
        if (o._id) return String(o._id);
        if (o.id) return String(o.id);
        if (o instanceof Date) return o.getTime();

        if (_.isString(o) || _.isNumber(o) || _.isBoolean(o)) {
            return String(o);
        }

        if (_.isArray(o)) {
            return o.map(a => this.flattenObject(a));
        }

        if (_.isPlainObject(o)) {
            return Object.values(o).map(a => this.flattenObject(a));//might lead to dups
        }

        return String(o);
    }
}
