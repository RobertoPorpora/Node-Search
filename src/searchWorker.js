import { parentPort } from 'worker_threads'
import * as fs from 'fs'
import * as path from 'path'

let globalPatterns = []
let globalId = null
let globalMaxFolders = 0

parentPort.on('message', (msg) => {
    if (msg.patterns != undefined) {
        for (const pattern of msg.patterns) {
            globalPatterns.push(pattern)
        }
    }
    if (msg.path != undefined) {
        searchThings(msg.path)
    }
    if (msg.id != undefined) {
        globalId = msg.id
    }
    if (msg.maxElementsCount) {
        globalMaxFolders = msg.maxElementsCount
    }
})

function searchThings(path) {
    let matches = []
    let folders = []
    try {
        let scan = dirListFull(path)
        if (scan.length < globalMaxFolders) {
            for (const e of scan) {
                try {
                    if (matchingCriteria(e))
                        matches.push(e)
                    if (fs.statSync(e).isDirectory())
                        folders.push(e)
                } catch {
                    // do nothing and don't stop main cycle
                }
            }
        }
    } catch (error) {
        // do nothing
    } finally {
        parentPort.postMessage({
            folders: folders,
            matches: matches
        })
    }
}

function matchingCriteria(str) {
    let match = path.basename(str).toLowerCase()
    for (const pattern of globalPatterns) {
        if (!match.includes(pattern)) {
            return false
        }
    }
    return true
}

function dirListFull(dir) {
    let list = []
    fs.readdirSync(dir).forEach(file => {
        list.push(path.join(dir, file))
    })
    return list
}