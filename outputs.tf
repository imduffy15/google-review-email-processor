output "s3_bucket_name" {
  description = "The name of the S3 bucket created for storing emails"
  value       = aws_s3_bucket.email_bucket.id
}

output "s3_bucket_arn" {
  description = "The ARN of the S3 bucket created for storing emails"
  value       = aws_s3_bucket.email_bucket.arn
}

output "lambda_function_name" {
  description = "The name of the Lambda function created for processing emails"
  value       = aws_lambda_function.email_processor.function_name
}

output "lambda_function_arn" {
  description = "The ARN of the Lambda function created for processing emails"
  value       = aws_lambda_function.email_processor.arn
}

output "ses_rule_set_name" {
  description = "The name of the SES rule set created"
  value       = aws_ses_receipt_rule_set.main.rule_set_name
}

output "ses_rule_name" {
  description = "The name of the SES rule created for storing emails"
  value       = aws_ses_receipt_rule.store.name
}

output "lambda_execution_role_name" {
  description = "The name of the IAM role created for Lambda execution"
  value       = aws_iam_role.lambda_exec_role.name
}

output "lambda_execution_role_arn" {
  description = "The ARN of the IAM role created for Lambda execution"
  value       = aws_iam_role.lambda_exec_role.arn
}
