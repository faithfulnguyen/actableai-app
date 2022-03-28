import smtplib
from email.mime.text import MIMEText
from flask import render_template, url_for

from superset import app


class MailGun(object):
    def __init__(self):
        self.server_name = app.config.get('MAILGUN_SERVER_NAME')
        self.port = app.config.get('MAILGUN_PORT')
        self.account = app.config.get("MAILGUN_ACCOUNT")
        self.password = app.config.get("MAILGUN_PASSWORD")
        self.mail_form = app.config.get("MAILGUN_FROM")
        self.superset_domain = app.config.get("SUPERSET_DOMAIN")

    def send_forgot_password(self, mail_to, link):
        content = ("Hi there,\nTo reset your superet password, please go to the "
                   "following page:\n{}/resetpassword?token={}\nIf you do not wish to "
                   "reset your password, ignore this message. It will expire in 10"
                   "minutes.").format(self.superset_domain, link)
        msg = MIMEText(content)
        msg["Subject"] = "Password reset"
        msg["From"] = self.mail_form
        msg["To"] = mail_to

        s = smtplib.SMTP(self.server_name, self.port)

        s.login(self.account, self.password)
        s.sendmail(msg["From"], msg["To"], msg.as_string())
        return s.quit()

    def send_password_to_new_user(self, mail_to, username, password):
        html = render_template('email/send_password.html', superset_domain=self.superset_domain, username=username,
                               password=password)
        msg = MIMEText(html, 'html')
        msg["Subject"] = "Actable website invitation"
        msg["From"] = self.mail_form
        msg["To"] = mail_to

        s = smtplib.SMTP(self.server_name, self.port)
        s.login(self.account, self.password)
        s.sendmail(msg["From"], msg["To"], msg.as_string())
        return s.quit()

    def send_activation_email(self, register_user, first_name, username):
        email_template = "email/activation_account.html"
        url = url_for(
            ".activation",
            _external=True,
            activation_hash=register_user.registration_hash,
        )
        last_name = register_user.last_name

        html = render_template(email_template, first_name=first_name, last_name=last_name,
                               username=username, url=url)

        msg = MIMEText(html, 'html')
        msg["Subject"] = "Actable account activation"
        msg["From"] = self.mail_form
        msg["To"] = register_user.email

        s = smtplib.SMTP(self.server_name, self.port)
        s.login(self.account, self.password)
        s.sendmail(msg["From"], msg["To"], msg.as_string())
        return s.quit()
