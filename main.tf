terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    external = {
      source  = "hashicorp/external"
      version = "~> 2.2"
    }
  }
}

provider "aws" {}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "email_bucket" {
  bucket = "${data.aws_caller_identity.current.account_id}-google-review-email-processor"
}

resource "aws_s3_bucket_lifecycle_configuration" "bucket_lifecycle" {
  bucket = aws_s3_bucket.email_bucket.id

  rule {
    id     = "delete_after_30_days"
    status = "Enabled"

    expiration {
      days = 1
    }
  }
}

resource "aws_s3_bucket_policy" "allow_ses_puts" {
  bucket = aws_s3_bucket.email_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSESPuts"
        Effect = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.email_bucket.arn}/*"
        Condition = {
          StringEquals = {
            "aws:Referer" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

resource "aws_ses_receipt_rule_set" "main" {
  rule_set_name = "main-rule-set"
}

resource "aws_ses_receipt_rule" "store" {
  name          = "store"
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
  recipients    = ["reviews@data.ianduffy.ie"]
  enabled       = true
  scan_enabled  = true

  s3_action {
    bucket_name = aws_s3_bucket.email_bucket.id
    position    = 1
  }

  depends_on = [
    aws_s3_bucket_policy.allow_ses_puts,
    aws_s3_bucket_notification.bucket_notification
  ]
}

resource "aws_lambda_function" "email_processor" {
  filename         = data.external.lambda_archive.result.src_path
  source_code_hash = data.external.lambda_archive.result.src_hash
  function_name    = "google_reviewer_processor"
  role             = aws_iam_role.lambda_exec_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  architectures    = ["arm64"]
  timeout          = 60
  layers           = [aws_lambda_layer_version.node_modules.arn]
}

resource "aws_lambda_layer_version" "node_modules" {
  filename         = data.external.lambda_archive.result.node_modules_path
  source_code_hash = data.external.lambda_archive.result.node_modules_hash

  layer_name = "node_modules"

  compatible_runtimes      = ["nodejs18.x"]
  compatible_architectures = ["arm64"]
}

data "external" "lambda_archive" {
  program     = ["bash", "-c", "npm run build > /dev/null 2>&1 && cat ./build/layer-metadata.json"]
  working_dir = "${path.module}/google-review-email-processor"
}

resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = aws_s3_bucket.email_bucket.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.email_processor.arn
    events              = ["s3:ObjectCreated:*"]
  }

  depends_on = [aws_lambda_permission.allow_s3]
}

resource "aws_iam_role" "lambda_exec_role" {
  name = "google-review-processor"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.email_processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.email_bucket.arn
}

resource "aws_iam_role_policy_attachment" "lambda_s3_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
  role       = aws_iam_role.lambda_exec_role.name
}

resource "aws_iam_role_policy_attachment" "lambda_basic_exec_policy" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda_exec_role.name
}
