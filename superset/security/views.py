import humanize
import logging

from datetime import datetime
from flask import flash, Markup, redirect
from flask_babel import lazy_gettext
from flask_wtf.recaptcha import RecaptchaField
from sqlalchemy import Column, String
from werkzeug.security import generate_password_hash
from wtforms import BooleanField, PasswordField, StringField
from wtforms.validators import DataRequired, Email, EqualTo

from flask_appbuilder._compat import as_unicode
from flask_appbuilder.fieldwidgets import BS3PasswordFieldWidget, BS3TextFieldWidget
from flask_appbuilder.forms import DynamicForm
from flask_appbuilder.models.decorators import renders
from flask_appbuilder.security.registerviews import RegisterUserDBView
from flask_appbuilder.security.sqla.models import User
from flask_appbuilder.security.views import UserDBModelView
from flask_appbuilder.validators import Unique
from flask_appbuilder import const as c, expose
from flask_appbuilder.widgets import  SearchWidget
from flask_appbuilder.urltools import (
    get_filter_args,
    get_order_args,
    get_page_args,
    get_page_size_args,
)
from flask_appbuilder.models.sqla.filters import BaseFilter
from flask import request
from sqlalchemy import or_

from superset.utils import hubspot_registration

log = logging.getLogger(__name__)

class MyUser(User):
    __tablename__ = "ab_user"

    def __repr__(self):
        return self.email

    @property
    def changed_on_humanized_last_login(self):
        if self.last_login:
            return humanize.naturaltime(datetime.now() - self.last_login)
        return None

    @property
    def changed_on_humanized_registration_date(self):
        return humanize.naturaltime(datetime.now() - self.created_on)

    @renders("last_login")
    def last_activity(self):
        return Markup(f'<span class="no-wrap">{self.changed_on_humanized_last_login}</span>')

    @renders("created_on")
    def registration_date(self):
        return Markup(f'<span class="no-wrap">{self.changed_on_humanized_registration_date}</span>')

class SearchUserFilter(BaseFilter): 
    def apply(self, query, value):
        query = query.filter(or_(
            MyUser.username.ilike('%'+value+'%'),
            MyUser.first_name.ilike('%'+value+'%'),
            MyUser.last_name.ilike('%'+value+'%'),
            MyUser.email.ilike('%'+value+'%')
        ))
        return query
        

class UserSearchWidget(SearchWidget):
    template = "superset/fab_overrides/widgets/user/search.html"

class CustomUserDBModelView(UserDBModelView):
    raw_password = Column(String(256))

    def pre_add(self, item):
        item.raw_password = item.password
        item.password = generate_password_hash(item.password)

    def post_add(self, item):
        from superset.utils.mailgun import MailGun
        mail_gun = MailGun()
        mail_gun.send_password_to_new_user(
            item.email, item.username, item.raw_password)
        pass

    list_columns = ["first_name", "last_name", "username", "email",
                    "active", "roles", "registration_date", "last_activity"]
                    
    search_widget = UserSearchWidget

    def _list(self):
        """
            list function logic, override to implement search logic
            returns list and search widget
        """
        if get_order_args().get(self.__class__.__name__):
            order_column, order_direction = get_order_args().get(
                self.__class__.__name__
            )
        else:
            order_column, order_direction = "", ""
        page = get_page_args().get(self.__class__.__name__)
        page_size = get_page_size_args().get(self.__class__.__name__)
        get_filter_args(self._filters)
        search_text = request.args.get('search_text')
        self._base_filters = self.datamodel.get_filters().add_filter_list(
            [['', SearchUserFilter, search_text or '']]
        )
        widgets = self._get_list_widget(
            filters=self._filters,
            order_column=order_column,
            order_direction=order_direction,
            page=page,
            page_size=page_size,
        )
        form = self.search_form.refresh()
        self.update_redirect()
        return self._get_search_widget(form=form, widgets=widgets)

class CustomRegisterUserDBForm(DynamicForm):

    first_name = StringField(
        lazy_gettext("First Name"),
        validators=[DataRequired()],
        widget=BS3TextFieldWidget(),
    )
    last_name = StringField(
        lazy_gettext("Last Name"),
        validators=[DataRequired()],
        widget=BS3TextFieldWidget(),
    )
    email = StringField(
        lazy_gettext("Email"),
        validators=[DataRequired(), Email()],
        widget=BS3TextFieldWidget(),
    )
    password = PasswordField(
        lazy_gettext("Password"),
        description=lazy_gettext(
            "Please use a good password policy,"
            " this application does not check this for you"
        ),
        validators=[DataRequired()],
        widget=BS3PasswordFieldWidget(),
    )
    conf_password = PasswordField(
        lazy_gettext("Confirm Password"),
        description=lazy_gettext("Please rewrite the password to confirm"),
        validators=[
            DataRequired(),
            EqualTo("password", message=lazy_gettext("Passwords must match"))
        ],
        widget=BS3PasswordFieldWidget(),
    )
    recaptcha = RecaptchaField()
    terms = BooleanField(
        "Terms & Conditions",
        description=lazy_gettext("Accept the <a href=\"https://www.actable.ai/terms-and-conditions\" target=\"_blank\">terms and conditions</a> to register."),
        validators=[DataRequired()]
    )

class CustomRegisterUserDBView(RegisterUserDBView):

    form = CustomRegisterUserDBForm

    def add_form_unique_validations(self, form):
        datamodel_user = self.appbuilder.sm.get_user_datamodel
        datamodel_register_user = self.appbuilder.sm.get_register_user_datamodel
        if len(form.email.validators) == 2:
            form.email.validators.append(Unique(datamodel_user, "email"))
            form.email.validators.append(
                Unique(datamodel_register_user, "email"))

    def add_registration(self, first_name, last_name, email, password=""):
        register_user = self.appbuilder.sm.add_register_user(
            email, first_name, last_name, email, password
        )
        if register_user:
            from superset.utils.mailgun import MailGun
            mail_gun = MailGun()
            mail_gun.send_activation_email(register_user, first_name, email)
            flash(as_unicode(self.message), "info")
            return register_user
        else:
            flash(as_unicode(self.error_message), "danger")
            return False

    def form_post(self, form):
        form.terms
        self.add_form_unique_validations(form)
        self.add_registration(
            first_name=form.first_name.data,
            last_name=form.last_name.data,
            email=form.email.data,
            password=form.password.data,
        )

    @expose("/activation/<string:activation_hash>")
    def activation(self, activation_hash):
        """
            Endpoint to expose an activation url, this url
            is sent to the user by email, when accessed the user is inserted
            and activated
        """
        reg = self.appbuilder.sm.find_register_user(activation_hash)
        if not reg:
            log.error(c.LOGMSG_ERR_SEC_NO_REGISTER_HASH.format(activation_hash))
            flash(as_unicode(self.false_error_message), "danger")
            return redirect(self.appbuilder.get_url_for_index)
        user = self.appbuilder.sm.add_user(
            username=reg.username,
            email=reg.email,
            first_name=reg.first_name,
            last_name=reg.last_name,
            role=self.appbuilder.sm.find_role(
                self.appbuilder.sm.auth_user_registration_role
            ),
            hashed_password=reg.password,
        )
        if not user:
            flash(as_unicode(self.error_message), "danger")
            return redirect(self.appbuilder.get_url_for_index)
        else:
            hubspot_registration(user, '/register/form')

            self.appbuilder.sm.del_register_user(reg)
            
            # Create wordspace of user
            from superset.models.custom import Workspace
            user = self.appbuilder.sm.find_user(username=reg.username)
            Workspace.create_user_workspace(user)
            
            return self.render_template(
                self.activation_template,
                username=reg.username,
                first_name=reg.first_name,
                last_name=reg.last_name,
                appbuilder=self.appbuilder,
            )

