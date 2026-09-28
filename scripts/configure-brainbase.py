"""Apply canonical agent prompts and the native graph; --verify is read-only."""
import argparse
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PROMPTS = {
    'scout': 'agents/scout/instructions-live.md',
    'investment': 'agents/investment/instructions-live.md',
    'resurrection': 'agents/resurrection/instructions-live.md',
    'product': 'agents/product/instructions.md',
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--verify', action='store_true', help='Compare remote prompts without changing anything')
    args = parser.parse_args()
    env = dict(line.split('=', 1) for line in (ROOT / '.dev.vars').read_text().splitlines()
               if '=' in line and not line.startswith('#'))

    def api(path, method='GET', body=None):
        request = urllib.request.Request(
            'https://api.brainbaselabs.com' + path,
            data=json.dumps(body).encode() if body is not None else None,
            method=method,
            headers={'Authorization': 'Bearer ' + env['BRAINBASE_TOKEN'], 'Content-Type': 'application/json'},
        )
        with urllib.request.urlopen(request, timeout=40) as response:
            return json.load(response)

    config = ROOT / 'agents/live-config.json'
    prior = json.loads(config.read_text()) if config.exists() else {}
    ids = {
        'scout': '696fd5a8-86ec-48d1-a5fb-eadc9888f758',
        'investment': '08f30277-8773-407a-91cb-5b715bc837d7',
        'resurrection': 'afa937cf-5fe9-41be-9b7d-cdb023e123aa',
    }
    # Files are the source of truth: never append instructions to remote state,
    # and never overwrite the canonical files from a configuration run.
    prompts = {kind: (ROOT / path).read_text() for kind, path in PROMPTS.items()}
    if args.verify:
        matches = {}
        for kind in PROMPTS:
            agent_id = prior.get(kind) or ids.get(kind)
            matches[kind] = bool(agent_id) and api('/v2/agents/' + agent_id)['instructions'].strip() == prompts[kind].strip()
        print(json.dumps({'readOnly': True, 'canonicalPromptsMatch': matches}))
        return 0 if all(matches.values()) else 1

    orchestration = api('/v2/orchestrations/43440ca3-9869-4437-b5db-a42cce05a0da')
    for kind, agent_id in ids.items():
        api('/v2/agents/' + agent_id, 'PATCH', {'instructions': prompts[kind]})
    if prior.get('product'):
        product = api('/v2/agents/' + prior['product'], 'PATCH', {'instructions': prompts['product']})
    else:
        product = api('/v2/agents', 'POST', {
            'title': 'Afterlife Product Engineer', 'runtime_kind': 'codex', 'machine_kind': 'daytona',
            'group_id': orchestration['group_id'], 'instructions': prompts['product'],
        })
    ids['product'] = product['id']
    ids['orchestration'] = orchestration['id']
    config.write_text(json.dumps(ids, indent=2) + '\n')
    keys = ['from_agent_id', 'to_agent_id', 'description', 'payload_schema', 'settings']
    edges = [{key: edge[key] for key in keys if key in edge} for edge in orchestration['edges']
             if edge['from_agent_id'] != ids['resurrection']]
    payload_keys = ['repositoryUrl', 'sourceRevision', 'productName', 'capability', 'reproduction']
    edges.append({
        'from_agent_id': ids['resurrection'], 'to_agent_id': ids['product'],
        'description': 'Verified capability to a usable hosted product',
        'payload_schema': {'type': 'object', 'required': payload_keys,
                           'properties': {key: {'type': 'string'} for key in payload_keys},
                           'additionalProperties': False},
    })
    api('/v2/orchestrations/' + orchestration['id'], 'PATCH', {
        'name': 'Afterlife — discover to product',
        'members': list(dict.fromkeys(orchestration['members'] + [ids['product']])), 'edges': edges,
    })
    print(json.dumps({'configured': list(ids), 'productAgent': ids['product']}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
