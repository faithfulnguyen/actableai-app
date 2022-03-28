import logging
import requests
import time
from superset import app, db


def get_nifi_status(limit_rate=0):
    nifi_host = app.config.get('NIFI_HOST')
    logging.info("Wating for NIFI service is ready...")
    headers = {"Content-Type": "application/json"}
    status = False
    limit_count = 0
    while status is False:
        try:
            resp = requests.get(nifi_host + "/nifi-api/system-diagnostics", headers=headers)
            if resp.status_code == 200:
                status = True
                logging.info("Nifi service is already running!")
        except Exception as e:
            logging.error(e)
            if limit_rate > limit_count:
                logging.info("Nifi service isn't ready now, retry after 30 seconds...")
                limit_count += 1
                time.sleep(30)
            else:
                logging.info("Couldn't connect to nifi service...")
                break
    return status


def sap_template(url):
    nifi_host = app.config.get('NIFI_HOST')
    templates = requests.get(url).json()['templates']
    sapTemplate = {}
    for template in templates:
        if (template['template']['name'] == 'Scrape Linkedin'):
            sapTemplate = template
    if not sapTemplate:
        # Upload template if template exists
        file_name = 'Scrape_Linkedin.xml'
        process_root_url = nifi_host + '/nifi-api/process-groups/root'
        process_root = requests.get(process_root_url)
        process_root_id = process_root.json()['component']['id']
        upload_template_url = nifi_host + '/nifi-api/process-groups/{}/templates/upload'.format(process_root_id)
        file = {'template': open('/nifi-templates/{}'.format(file_name), 'rb')}
        r = requests.post(upload_template_url, files=file)
    # Get template
    templates = requests.get(url).json()['templates']
    for template in templates:
        if (template['template']['name'] == 'Scrape Linkedin'):
            sapTemplate = template
    return sapTemplate


def replace_new_process_id(olde_id, new_id):
    from superset.models import custom as modelsCustom
    existing_connect = (
        db.session.query(modelsCustom.LinkedinConnectInfo).filter_by(group_id=olde_id).one_or_none()
    )
    existing_connect.group_id = new_id
    db.session.commit()


def create_process_group(url, headers, email):
    create_process_group_json = {
        'revision': {
            'clientId': '',
            'version': 0
        },
        'disconnectedNodeAcknowledged': False,
        'component': {
            'name': email,
            'position': {
                'x': 1,
                'y': 1
            }
        }
    }
    return requests.post(
        url,
        headers=headers,
        json=create_process_group_json
    ).json()


def get_process_status(group_id):
    nifi_host = app.config.get('NIFI_HOST')
    try:
        groupInfo = requests.get(
            nifi_host + '/nifi-api/flow/process-groups/' + group_id,
        )
        return groupInfo.json()
    except Exception:
        return False


def sync_nifi_process():
    nifi_host = app.config.get('NIFI_HOST')
    from superset.models import custom as modelsCustom
    if get_nifi_status(10):
        nifi_api = nifi_host + '/nifi-api/'
        process_group_res = requests.get(nifi_api + "process-groups/root")
        process_group = process_group_res.json()
        headers = {"Accept": "application/json", "Content-Type": "application/json"}

        for linkedin_info in db.session.query(modelsCustom.LinkedinConnectInfo).all():
            logging.info("query data group id....{}".format(linkedin_info.group_id))
            # finished
            if linkedin_info.temp_cookies is None or int(
                    float(linkedin_info.total_result * linkedin_info.sample_rate / 1000)) == linkedin_info.current_page:
                continue
            else:
                currentProcessStatus = get_process_status(linkedin_info.group_id)
                if not currentProcessStatus:
                    new_process_group = create_process_group(
                        nifi_api + "process-groups/{}/process-groups".format(process_group["id"]), headers,
                        linkedin_info.email)
                    replace_new_process_id(linkedin_info.group_id, new_process_group["id"])
                    sapTemplate = sap_template(nifi_api + 'flow/templates')
                    # Create instance for template
                    createInstanceJson = {
                        'templateId': sapTemplate['id'],
                        'disconnectedNodeAcknowledged': False,
                        'originX': 1,
                        'originY': 1
                    }
                    resInstance = requests.post(
                        nifi_api + 'process-groups/{}/template-instance'.format(new_process_group['id']),
                        headers=headers,
                        json=createInstanceJson
                    ).json()
                    processors = resInstance['flow']['processors']
                    executeProcess = {}
                    putSQLProcess = {}
                    for processor in processors:
                        if (processor['inputRequirement'] == 'INPUT_FORBIDDEN'):
                            executeProcess = processor
                        elif (processor['component']['name'] == 'PutSQL'):
                            putSQLProcess = processor
                    # excute processors
                    clientId = requests.get(
                        nifi_api + 'flow/client-id'
                    ).text
                    excuteProcessorsJson = {
                        'component': {
                            'config': {
                                'properties': {
                                    'Command Arguments': '/scrapers/scrape_linkedin.js {} {} {} {} {} {} {} 0'.format(
                                        linkedin_info.email,
                                        linkedin_info.temp_cookies,
                                        linkedin_info.prefix,
                                        linkedin_info.sample_rate,
                                        linkedin_info.search_url,
                                        new_process_group["id"],
                                        linkedin_info.current_page),
                                },
                            },
                            'id': executeProcess['id'],
                        },
                        'revision': {
                            'clientId': clientId,
                            'version': 0
                        },
                    }
                    excuteProcessors = requests.put(
                        nifi_api + 'processors/{}'.format(executeProcess['id']),
                        json=excuteProcessorsJson,
                        headers=headers
                    )
                    # Running
                    ctlServices = requests.get(
                        nifi_api + 'flow/process-groups/{}/controller-services'.format(
                            new_process_group['id'])
                    ).json()
                    DBCPService = {}
                    for o in ctlServices['controllerServices']:
                        if (o['component']['referencingComponents'][0]['id'] == putSQLProcess['id']):
                            DBCPService = o
                    runningJson = {
                        'disconnectedNodeAcknowledged': False,
                        'state': 'ENABLED',
                        'revision': {
                            'clientId': clientId,
                            'version': 0
                        }
                    }
                    running = requests.put(
                        nifi_api + 'controller-services/{}/run-status'.format(DBCPService['id']),
                        json=runningJson,
                        headers=headers
                    )
                    processRunningJson = {
                        'disconnectedNodeAcknowledged': False,
                        'id': new_process_group['id'],
                        'state': 'RUNNING'
                    }
                    processRunning = requests.put(
                        nifi_api + 'flow/process-groups/{}'.format(new_process_group['id']),
                        json=processRunningJson,
                        headers=headers
                    )
    else:
        logging.error("An error occurred when run NIFI sync process job")
