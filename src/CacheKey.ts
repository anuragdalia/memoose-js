import {Schema} from "mongoose";
import objectHash from "object-hash";
import ObjectId = Schema.Types.ObjectId;
import _ from "lodash";


export class CacheKey {
    private readonly function_name: string;
    private readonly should_sort_args: boolean;

    constructor(function_name: string, should_sort_args: boolean) {
        this.function_name = function_name;
        this.should_sort_args = should_sort_args;
    }

    for(args: any[]) {
        let cache_key: string;

        let flattened_String = this.flattenObject([...args]);

        if (this.should_sort_args) flattened_String = flattened_String.sort();

        // if ([""].includes(this.function_name))
        //     console.log(this.function_name, "cache_key_gen", flattened_String);

        cache_key = objectHash([this.function_name, ...flattened_String], {
            ignoreUnknown: true,
            algorithm: 'md5'
        });
        return cache_key;
    }


    public flattenObject(o: any): any {

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
