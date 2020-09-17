import chalk from "chalk";
import {spawn as cp_spawn} from "child_process";
import fs from "fs";
import minimatch from "minimatch";
import ncp from "ncp";
import path from "path";
import util from "util";
import {println} from "./print";

const spawnP = util.promisify(cp_spawn);

export const runCmd = (cwd: string, command: string, ...args: string[]) => {
    try {
        return spawnP(command, [...args], {cwd, stdio: "inherit"});
    } catch (error) {
        println(chalk`{red Command failed: ${command} ${args.join(" ")}}`);
        println(chalk`{red CWD: ${cwd}}`);
        println(chalk`{red ${error.stack}}`);
        process.exit(1);
    }
};

export const readRecursive = async (
    dir: string,
    skip: string
): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        fs.readdir(dir, (err, children) => {
            if (err) {
                return reject(err);
            }
            Promise.all<string[]>(
                children.map((child) => {
                    if (child) {
                        if (minimatch(child, skip)) {
                            return Promise.resolve([]);
                        }
                    }
                    return new Promise<string[]>((res, rej) => {
                        fs.stat(path.join(dir, child), (err, info) => {
                            if (err) {
                                return rej(err);
                            }
                            if (info.isDirectory()) {
                                res(
                                    readRecursive(
                                        path.join(dir, child),
                                        skip
                                    ).then((children) =>
                                        children.map((file) =>
                                            path.join(child, file)
                                        )
                                    )
                                );
                            } else {
                                res([child]);
                            }
                        });
                    });
                })
            ).then((childLists) => {
                let arr: string[] = [];
                // ts doesn't like [].concat, I think it believes it's immutable.
                resolve(arr.concat(...childLists));
            });
        });
    });
};

export const pathExists = (filePath: string): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        fs.stat(filePath, (err) => {
            if (err && err.code === "ENOENT") {
                return resolve(false);
            } else if (err) {
                return reject(err);
            }
            resolve(true);
        });
    });
};

export const copy = (
    source: string,
    dest: string,
    options: ncp.Options = {}
): Promise<void> => {
    return new Promise((resolve, reject) =>
        ncp(source, dest, options, (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        })
    );
};
