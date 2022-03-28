import uuid

from flask import Markup
from flask_appbuilder import Model
from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    String,
    Text,
    Float,
    DateTime,
    Boolean,
    BigInteger,
    Enum
)
from sqlalchemy.dialects.postgresql import UUID
import requests
from superset import app, db, security_manager
from superset.models.helpers import AuditMixinNullable
from datetime import datetime
import enum
from sqlalchemy.orm import backref, Query, relationship
from superset.utils import core as utils
from superset.exceptions import SupersetException


class ActableConfig(Model, AuditMixinNullable):
    __tablename__ = "config"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text, nullable=False, unique=True)
    value = Column(Text)


class SapConnectInfo(Model):
    __tablename__ = "sap_connect_info"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False)
    end_point = Column(Text, nullable=False)
    api_key = Column(Text, nullable=False)
    group_id = Column(Text, nullable=False)

    def __init__(self, name, end_point, api_key, group_id):
        self.name = name
        self.end_point = end_point
        self.api_key = api_key
        self.group_id = group_id

    @property
    def status(self):
        group_id = self.group_id
        groupInfo = requests.get(
            app.config.get('NIFI_HOST') + '/nifi-api/flow/process-groups/' + group_id,
        )
        try:
            return groupInfo.json()
        except ValueError:
            return False

    def getProcessGroupId(self, api):
        return requests.get(api).json()

    def createProcessGroup(self, api, headers):
        createProcessGroupJson = {
            'revision': {
                'clientId': '',
                'version': 0
            },
            'disconnectedNodeAcknowledged': False,
            'component': {
                'name': self.name,
                'position': {
                    'x': 1,
                    'y': 1
                }
            }
        }
        return requests.post(
            api,
            headers=headers,
            json=createProcessGroupJson
        ).json()

    def saveNewProcessId(self, processId):
        existing_connect = (
            db.session.query(SapConnectInfo)
                .filter_by(end_point=self.end_point, api_key=self.api_key)
                .one_or_none()
        )
        existing_connect.group_id = processId
        db.session.commit()

    def sapTemplate(self, templateApi):
        templates = requests.get(templateApi).json()['templates']
        sapTemplate = {}
        for template in templates:
            if (template['template']['name'] == 'crawl SAP'):
                sapTemplate = template
        if not sapTemplate:
            # Upload template if template exists
            file_name = 'crawl_SAP.xml'
            nifi_host = app.config.get('NIFI_HOST')
            process_root_url = nifi_host + '/nifi-api/process-groups/root'
            process_root = requests.get(process_root_url)
            process_root_id = process_root.json()['component']['id']
            upload_template_url = nifi_host + '/nifi-api/process-groups/{}/templates/upload'.format(process_root_id)
            file = {'template': open('/nifi-templates/{}'.format(file_name), 'rb')}
            r = requests.post(upload_template_url, files=file)
        # Get template
        templates = requests.get(templateApi).json()['templates']
        for template in templates:
            if (template['template']['name'] == 'crawl SAP'):
                sapTemplate = template
        return sapTemplate

    def createNewCrawler(self):
        status = self.status
        if not status:
            nifi_api = app.config.get('NIFI_HOST') + '/nifi-api/'
            headers = {'Accept': 'application/json', 'Content-type': 'application/json'}
            # Get process group root id
            rootProcessGroup = self.getProcessGroupId(nifi_api + 'process-groups/root')
            # Create process group
            createProcessGroup = self.createProcessGroup(
                nifi_api + 'process-groups/{}/process-groups'.format(rootProcessGroup['id']),
                headers
            )
            self.saveNewProcessId(createProcessGroup['id'])
            # Get template
            sapTemplate = self.sapTemplate(nifi_api + 'flow/templates')
            # Create instance for template
            createInstanceJson = {
                'templateId': sapTemplate['id'],
                'disconnectedNodeAcknowledged': False,
                'originX': 1,
                'originY': 1
            }
            resInstance = requests.post(
                nifi_api + 'process-groups/{}/template-instance'.format(createProcessGroup['id']),
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
                            'Command Arguments': '-d {} -k {} -l 0.4'.format(self.end_point, self.api_key),
                            'Command': '/usr/local/bin/crawlsap',
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
                nifi_api + 'flow/process-groups/{}/controller-services'.format(createProcessGroup['id'])
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
                'id': createProcessGroup['id'],
                'state': 'RUNNING'
            }
            processRunning = requests.put(
                nifi_api + 'flow/process-groups/{}'.format(createProcessGroup['id']),
                json=processRunningJson,
                headers=headers
            )
            return 'Success'

    def checkProcessRunning(self):
        if self.running == 'STOPPED':
            nifi_api = app.config.get('NIFI_HOST') + '/nifi-api/'
            headers = {'Accept': 'application/json', 'Content-type': 'application/json'}
            processRunningJson = {
                'disconnectedNodeAcknowledged': False,
                'id': self.group_id,
                'state': 'RUNNING'
            }
            processRunning = requests.put(
                nifi_api + 'flow/process-groups/{}'.format(self.group_id),
                json=processRunningJson,
                headers=headers
            )

    @property
    def success(self) -> Markup:
        status = self.status
        self.createNewCrawler()
        self.checkProcessRunning()
        if status:
            connections = status['processGroupFlow']['flow']['connections']
            for x in connections:
                if (x['status']['name'] == 'success' and x['status']['sourceName'] == 'PutSQL'):
                    return x['status']['aggregateSnapshot']['queuedCount']
        else:
            return 'CRAWL STOPPED'

    @property
    def running(self) -> Markup:
        status = self.status
        if status:
            processors = status['processGroupFlow']['flow']['processors']
            for x in processors:
                if (x['component']['name'] == 'PutSQL'):
                    return x['component']['state']
        else:
            return 'CRAWL STOPPED'


class LinkedinConnectInfo(Model):
    __tablename__ = "linkedin_connect_info"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(50), nullable=False)
    group_id = Column(String(100), nullable=False)
    search_url = Column(Text, nullable=True)
    prefix = Column(String(100), nullable=True)
    sample_rate = Column(Float, nullable=True)
    current_page = Column(Integer, nullable=True)
    total_result = Column(Integer, nullable=True)
    temp_cookies = Column(Text, nullable=True)

    def __init__(self, email, group_id, search_url, prefix, sample_rate, current_page, total_result, temp_cookies):
        self.email = email
        self.group_id = group_id
        self.search_url = search_url
        self.prefix = prefix
        self.sample_rate = sample_rate
        self.current_page = current_page
        self.total_result = total_result
        self.temp_cookies = temp_cookies

    @property
    def status(self):
        group_id = self.group_id
        try:
            groupInfo = requests.get(
                app.config.get('NIFI_HOST') + '/nifi-api/flow/process-groups/' + group_id,
            )
            return groupInfo.json()
        except Exception:
            return False

    @property
    def success(self) -> Markup:
        if self.prefix is None:
            return 0
        else:
            try:
                table_name = self.prefix + "_profile"
                count_query = 'SELECT COUNT(*) FROM {}'.format(table_name)
                result = db.session.execute(count_query)
                result_as_list = result.fetchall()
                for row in result_as_list:
                    return row["count"]
            except Exception:
                return 0

    @property
    def running(self) -> Markup:
        try:
            if int(float(self.total_result * self.sample_rate / 1000)) == self.current_page:
                return 'FINISHED'
            status = self.status
            if status:
                processors = status['processGroupFlow']['flow']['processors']
                for x in processors:
                    if (x['component']['name'] == 'PutSQL'):
                        if x['component']['state'] == 'RUNNING' and int(
                                float(self.total_result * self.sample_rate / 1000)) == self.current_page:
                            return 'FINISHED'
                        return x['component']['state']
            else:
                return 'NO JOB'
        except:
            return 'NO JOB'


class CustomOntology(Model):
    __tablename__ = "custom_ontologies"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(255), nullable=False, unique=True)
    description = db.Column(db.String(255), nullable=True)
    synonyms = db.Column(db.String(255), nullable=True)


class LinkedInError(Model):
    __tablename__ = "linkedin_error"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    group_id = Column(String(100), nullable=False)
    error_message = Column(Text, nullable=True)


class TypeSubscription(enum.Enum):
    USAGE_BASED = 1
    USAGE_TRIAL = 2
    USAGE_UNLIMITED = 3


class IntervalPlan(enum.Enum):
    DAY = "day"
    MONTH = "month"
    YEAR = "year"


class RenewSubscription(enum.Enum):
    ACTIVATED = 1
    UNACTIVATED = 2


class BillingSubscription(Model):
    __tablename__ = "billing_subscriptions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("ab_user.id"), nullable=False)
    stripe_customer_id = Column(String(100), nullable=True)
    stripe_subscription_id = Column(String(100), nullable=True)
    stripe_product_id = Column(String(100), nullable=True)
    start_time = Column(DateTime, default=datetime.now, nullable=True)
    due_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    renew = Column(Enum(RenewSubscription), default=RenewSubscription.ACTIVATED, nullable=False)
    billing_available_time = Column(Integer, nullable=True)
    monthly_price = Column(Float, default=0)
    type = Column(Enum(TypeSubscription),
                  default=TypeSubscription.USAGE_BASED)


class BillingBalanceHistory(Model):
    __tablename__ = "billing_balance_history"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("ab_user.id"), nullable=False)
    task_id = Column(String(100), nullable=True)
    viz_type = Column(String(100), nullable=True)
    url = Column(Text, nullable=True)
    create_time = Column(DateTime, default=datetime.now, nullable=False)
    number_of_seconds = Column(Integer, default=0)


class BillingPromoHistory(Model):
    __tablename__ = "billing_promo_history"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("ab_user.id"), nullable=False)
    promo_id = Column(String(100))
    subscription_id = Column(BigInteger, ForeignKey(
        "billing_subscriptions.id"), nullable=False)


class Workspace(Model):
    __tablename__ = "actable_workspace"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(UUID(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False)
    user_id = Column(BigInteger, ForeignKey("ab_user.id"), nullable=False)
    db_id = Column(BigInteger, ForeignKey("dbs.id"), nullable=False)

    user = relationship(security_manager.user_model, backref=backref("workspace", cascade='all, delete-orphan'), foreign_keys=[user_id])
    database = relationship("Database", foreign_keys=[db_id])

    def __init__(self, user, db):
        self.user = user
        self.database = db
        self.name = uuid.uuid4()

    def __repr__(self):
        return self.name

    @staticmethod
    def create_user_workspace(user):
        db_create_user_workspace = app.config["DB_FOR_CREATE_USER_WORKSPACE"] or "examples"
        database = utils.get_db_by_name(db_create_user_workspace)
        workspace = Workspace(user, database)
        workspace.create_schema()
        session = db.session
        session.add(workspace)
        session.commit()
        return workspace

    @staticmethod
    def get_or_create_workspace(user):
        workspace = db.session.query(
            Workspace).filter_by(user_id=user.id).first()
        if workspace != None:
            if Workspace.check_exist_schema(workspace, str(workspace.name)) is False:
                workspace.create_schema()
            return workspace
        else:
            return Workspace.create_user_workspace(user)

    def create_schema(self):
        return self.database.create_schema(str(self.name))

    @staticmethod
    def check_exist_schema(self, schema_name):
        return self.database.check_exist_schema(schema_name)

    @staticmethod
    def get_workspace_user(user):
        return db.session.query(Workspace).filter_by(user_id=user.id).first()
